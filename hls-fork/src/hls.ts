import { uuid } from '@svta/common-media-library/utils/uuid';
import { EventEmitter } from 'eventemitter3';
import { buildAbsoluteURL } from 'url-toolkit';
import { enableStreamingMode, hlsDefaultConfig, mergeConfig } from './config';
import { FragmentTracker } from './controller/fragment-tracker';
import LevelController from './controller/level-controller';
import { ErrorDetails, ErrorTypes } from './errors';
import { Events } from './events';
import { isMSESupported, isSupported } from './is-supported';
import KeyLoader from './loader/key-loader';
import { LevelKey } from './loader/level-key';
import PlaylistLoader from './loader/playlist-loader';
import { MetadataSchema } from './types/demuxer';
import { type HdcpLevel, isHdcpLevel, type Level } from './types/level';
import { PlaylistLevelType } from './types/loader';
import { hexToArrayBuffer } from './utils/hex';
import { enableLogs, type ILogger } from './utils/logger';
import { getMediaDecodingInfoPromise } from './utils/mediacapabilities-helper';
import { getMediaSource } from './utils/mediasource-helper';
import { getAudioTracksByGroup } from './utils/rendition-helper';
import { version } from './version';
import type { HlsConfig } from './config';
import type AbrController from './controller/abr-controller';
import type AudioStreamController from './controller/audio-stream-controller';
import type AudioTrackController from './controller/audio-track-controller';
import type BasePlaylistController from './controller/base-playlist-controller';
import type { InFlightData, State } from './controller/base-stream-controller';
import type BaseStreamController from './controller/base-stream-controller';
import type BufferController from './controller/buffer-controller';
import type CapLevelController from './controller/cap-level-controller';
import type CMCDController from './controller/cmcd-controller';
import type ContentSteeringController from './controller/content-steering-controller';
import type EMEController from './controller/eme-controller';
import type ErrorController from './controller/error-controller';
import type FPSController from './controller/fps-controller';
import type GapController from './controller/gap-controller';
import type {
  HlsIFramesOnly,
  IFrameController,
} from './controller/iframe-controller';
import type InterstitialsController from './controller/interstitials-controller';
import type { InterstitialsManager } from './controller/interstitials-controller';
import type LatencyController from './controller/latency-controller';
import type StreamController from './controller/stream-controller';
import type { SubtitleStreamController } from './controller/subtitle-stream-controller';
import type SubtitleTrackController from './controller/subtitle-track-controller';
import type Decrypter from './crypt/decrypter';
import type TransmuxerInterface from './demux/transmuxer-interface';
import type { HlsEventEmitter, HlsListeners } from './events';
import type FragmentLoader from './loader/fragment-loader';
import { LoadStats } from './loader/load-stats';
import { Fragment, isMediaFragment } from './loader/fragment';
import { LevelDetails } from './loader/level-details';
import { AttrList } from './utils/attr-list';
import type { TimestampOffset } from './utils/timescale-conversion';
import type M3U8Parser from './loader/m3u8-parser';
import type TaskLoop from './task-loop';
import type { AttachMediaSourceData } from './types/buffer';
import type {
  AbrComponentAPI,
  ComponentAPI,
  NetworkComponentAPI,
} from './types/component-api';
import type {
  FragLoadedData,
  LevelLoadedData,
  MediaAttachingData,
} from './types/events';
import type { LoaderStats } from './types/loader';
import type { LevelParsed } from './types/level';
import type {
  AudioSelectionOption,
  MediaPlaylist,
  SubtitleSelectionOption,
  VideoSelectionOption,
} from './types/media-playlist';
import type BaseLoader from './utils/base-loader';
import type { BufferInfo, BufferTimeRange } from './utils/buffer-helper';
import type Cues from './utils/cues';
import type EwmaBandWidthEstimator from './utils/ewma-bandwidth-estimator';
import type FetchLoader from './utils/fetch-loader';
import type { MediaDecodingInfo } from './utils/mediacapabilities-helper';
import type XhrLoader from './utils/xhr-loader';

/**
 * The `Hls` class is the core of the HLS.js library used to instantiate player instances.
 * @public
 */
export default class Hls implements HlsEventEmitter {
  private static defaultConfig: HlsConfig | undefined;

  /**
   * The runtime configuration used by the player. At instantiation this is combination of `hls.userConfig` merged over `Hls.DefaultConfig`.
   */
  public readonly config: HlsConfig;

  /**
   * The configuration object provided on player instantiation.
   */
  public readonly userConfig: Partial<HlsConfig>;

  /**
   * The logger functions used by this player instance, configured on player instantiation.
   */
  public readonly logger: ILogger;

  protected _url: string | null = null;
  protected streamController: StreamController;
  private coreComponents: ComponentAPI[];
  private networkControllers: NetworkComponentAPI[];
  private _emitter: HlsEventEmitter = new EventEmitter();
  /**
   * 下载速度（缓冲速度）采样窗口，单位毫秒。
   *
   * 只统计最近这段时间内完成的加载：既能反映当前网速，又不会被单次抖动带偏。
   * 点播分片通常 2–6 秒一个，5 秒窗口一般覆盖最近 1–2 次传输。
   */
  private static readonly DOWNLOAD_SPEED_WINDOW_MS = 5000;
  /** 下载速度采样：`time` 为采样时刻（performance.now()），`speed` 为本次加载的字节/秒 */
  private downloadSpeedSamples: { time: number; speed: number }[] = [];
  private _autoLevelCapping: number = -1;
  private _maxHdcpLevel: HdcpLevel = null;
  private abrController: AbrComponentAPI;
  private bufferController: BufferController;
  private capLevelController: CapLevelController;
  private latencyController?: LatencyController;
  private levelController: LevelController;
  private _playlistLoader: PlaylistLoader;
  private audioStreamController?: AudioStreamController;
  private subtititleStreamController?: SubtitleStreamController;
  private audioTrackController?: AudioTrackController;
  private subtitleTrackController?: SubtitleTrackController;
  private interstitialsController?: InterstitialsController;
  private iframeController?: IFrameController;
  private gapController?: GapController;
  private emeController?: EMEController;
  private cmcdController?: CMCDController;
  private _media: HTMLMediaElement | null = null;
  private _sessionId?: string;
  private triggeringException?: boolean;
  private started: boolean = false;

  /**
   * Get the video-dev/hls.js package version.
   */
  static get version(): string {
    return version;
  }

  /**
   * Check if the required MediaSource Extensions are available.
   */
  static isMSESupported(): boolean {
    return isMSESupported();
  }

  /**
   * Check if MediaSource Extensions are available and isTypeSupported checks pass for any baseline codecs.
   */
  static isSupported(): boolean {
    return isSupported();
  }

  /**
   * Get the MediaSource global used for MSE playback (ManagedMediaSource, MediaSource, or WebKitMediaSource).
   */
  static getMediaSource(): typeof MediaSource | undefined {
    return getMediaSource();
  }

  static get Events(): typeof Events {
    return Events;
  }

  static get MetadataSchema(): typeof MetadataSchema {
    return MetadataSchema;
  }

  static get ErrorTypes(): typeof ErrorTypes {
    return ErrorTypes;
  }

  static get ErrorDetails(): typeof ErrorDetails {
    return ErrorDetails;
  }

  /**
   * Get the default configuration applied to new instances.
   */
  static get DefaultConfig(): HlsConfig {
    if (!Hls.defaultConfig) {
      return hlsDefaultConfig;
    }

    return Hls.defaultConfig;
  }

  /**
   * Replace the default configuration applied to new instances.
   */
  static set DefaultConfig(defaultConfig: HlsConfig) {
    Hls.defaultConfig = defaultConfig;
  }

  /**
   * Creates an instance of an HLS client that can attach to exactly one `HTMLMediaElement`.
   * @param userConfig - Configuration options applied over `Hls.DefaultConfig`
   */
  constructor(userConfig: Partial<HlsConfig> = {}) {
    const logger = (this.logger = enableLogs(
      userConfig.debug || false,
      'Hls instance',
      userConfig.loggerId || userConfig.assetPlayerId,
    ));
    const config = (this.config = mergeConfig(
      Hls.DefaultConfig,
      userConfig,
      logger,
    ));
    this.userConfig = userConfig;

    if (config.progressive) {
      enableStreamingMode(config, logger);
    }

    // core controllers and network loaders
    const {
      streamController: _StreamController,
      abrController: _AbrController,
      bufferController: _BufferController,
      capLevelController: _CapLevelController,
      errorController: _ErrorController,
      fpsController: _FpsController,
      id3TrackController: _ID3TrackController,
      iframeController: _IFrameController,
      gapController: _GapController,
    } = config;
    const errorController = new _ErrorController(this);
    const abrController = (this.abrController = new _AbrController(this));
    // FragmentTracker must be defined before StreamController because the order of event handling is important
    const fragmentTracker = new FragmentTracker(this);
    const _InterstitialsController = config.interstitialsController;
    const interstitialsController = _InterstitialsController
      ? (this.interstitialsController = new _InterstitialsController(this, Hls))
      : null;
    const bufferController = (this.bufferController = new _BufferController(
      this,
      fragmentTracker,
    ));
    const capLevelController = (this.capLevelController =
      new _CapLevelController(this));

    const fpsController = _FpsController ? new _FpsController(this) : null;
    const playListLoader = (this._playlistLoader = new PlaylistLoader(this));

    const _ContentSteeringController = config.contentSteeringController;
    // Instantiate ConentSteeringController before LevelController to receive Multivariant Playlist events first
    const contentSteering = _ContentSteeringController
      ? new _ContentSteeringController(this)
      : null;
    const levelController = (this.levelController = new LevelController(
      this,
      contentSteering,
    ));

    const id3TrackController = _ID3TrackController
      ? new _ID3TrackController(this)
      : undefined;

    const keyLoader = new KeyLoader(this.config, this.logger);
    const streamController = (this.streamController = new _StreamController(
      this,
      fragmentTracker,
      keyLoader,
    ));

    const gapController = (this.gapController = _GapController
      ? new _GapController(this, fragmentTracker)
      : undefined);

    // Cap level controller uses streamController to flush the buffer
    capLevelController.setStreamController(streamController);

    const networkControllers: NetworkComponentAPI[] = [
      playListLoader,
      levelController,
      streamController,
    ];
    if (interstitialsController) {
      networkControllers.splice(1, 0, interstitialsController);
    }
    if (contentSteering) {
      networkControllers.splice(1, 0, contentSteering);
    }

    this.networkControllers = networkControllers;
    const coreComponents: ComponentAPI[] = [abrController, bufferController];
    if (gapController) {
      coreComponents.push(gapController);
    }
    coreComponents.push(capLevelController);
    if (fpsController) {
      // fpsController uses streamController to switch when frames are being dropped
      fpsController.setStreamController(streamController);
      coreComponents.push(fpsController);
    }
    if (id3TrackController) {
      coreComponents.push(id3TrackController);
    }
    coreComponents.push(fragmentTracker);

    this.audioTrackController = this.createController(
      config.audioTrackController,
      networkControllers,
    );
    const AudioStreamControllerClass = config.audioStreamController;
    if (AudioStreamControllerClass) {
      networkControllers.push(
        (this.audioStreamController = new AudioStreamControllerClass(
          this,
          fragmentTracker,
          keyLoader,
        )),
      );
    }
    // Instantiate subtitleTrackController before SubtitleStreamController to receive level events first
    this.subtitleTrackController = this.createController(
      config.subtitleTrackController,
      networkControllers,
    );
    const SubtitleStreamControllerClass = config.subtitleStreamController;
    if (SubtitleStreamControllerClass) {
      networkControllers.push(
        (this.subtititleStreamController = new SubtitleStreamControllerClass(
          this,
          fragmentTracker,
          keyLoader,
        )),
      );
    }
    this.createController(config.timelineController, coreComponents);
    keyLoader.emeController = this.emeController = this.createController(
      config.emeController,
      coreComponents,
    );
    this.cmcdController = this.createController(
      config.cmcdController,
      coreComponents,
    );
    this.latencyController = this.createController(
      config.latencyController,
      coreComponents,
    );
    this.coreComponents = coreComponents;

    this.iframeController = _IFrameController
      ? new _IFrameController(this, Hls)
      : undefined;

    // Error controller handles errors before and after all other controllers
    // This listener will be invoked after all other controllers error listeners
    networkControllers.push(errorController);
    const onErrorOut = errorController.onErrorOut;
    if (typeof onErrorOut === 'function') {
      this.on(Events.ERROR, onErrorOut, errorController);
    }
    // Autostart load handler
    this.on(
      Events.MANIFEST_LOADED,
      playListLoader.onManifestLoaded,
      playListLoader,
    );
    // 下载速度采样：分片与清单加载完成后各记录一次，供 getDownloadSpeed() 读取
    this.on(Events.FRAG_LOADED, this.onFragLoadedForDownloadSpeed, this);
    this.on(Events.LEVEL_LOADED, this.onLevelLoadedForDownloadSpeed, this);
  }

  private createController(ControllerClass, components: ComponentAPI[]) {
    if (ControllerClass) {
      const controllerInstance = new ControllerClass(this);
      if (components) {
        components.push(controllerInstance);
      }
      return controllerInstance;
    }
    return null;
  }

  // Delegate the EventEmitter through the public API of Hls.js
  on<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context: Context = this as any,
  ) {
    this._emitter.on(event, listener, context);
  }

  /**
   * 获取当前下载速度（即「缓冲速度」），单位：**字节/秒**
   *
   * hls.js 官方只提供面向 ABR 码率决策的带宽估计（`bandwidthEstimate`，单位比特/秒），
   * 没有可直接用于展示的下载速度。本方法在分片/清单加载完成时采样**真实传输字节数与耗时**，
   * 返回最近 {@link Hls.DOWNLOAD_SPEED_WINDOW_MS} 毫秒内采样的算术平均，
   * 供播放器显示「正在缓冲 xx KB/S / MB/S」。
   *
   * 与 `bandwidthEstimate` 的区别：
   * - 单位是**字节/秒**（不是比特/秒），可直接用于「字节/秒」语义的 UI，无需再做换算；
   * - **扣除 TTFB**（首字节时间），只反映实际传输速率（与 hls.js 内部 bwEstimator 的口径一致）；
   * - 只做时间窗口平均、不做 EWMA 平滑，数值更贴近「此刻有多快」。
   *
   * @returns 下载速度（字节/秒）。**尚无有效采样时返回 0**（例如首个分片尚未下载完成，
   *          或加载被中止、无字节数据），调用方应据此隐藏速度显示，而不要显示 0
   */
  getDownloadSpeed(): number {
    this.pruneDownloadSpeedSamples(performance.now());
    const samples = this.downloadSpeedSamples;
    if (samples.length === 0) {
      return 0;
    }
    let total = 0;
    for (let i = 0; i < samples.length; i++) {
      total += samples[i].speed;
    }
    return total / samples.length;
  }

  /**
   * 记录一次加载的下载速度（内部使用，由 FRAG_LOADED / LEVEL_LOADED 触发）
   *
   * @param stats - 加载器统计（hls.js 的 `LoaderStats`）
   */
  private recordDownloadSpeed(stats?: LoaderStats): void {
    if (!stats) {
      return;
    }
    const { start, first, end } = stats.loading;
    const bytes = stats.loaded;
    const timeLoading = end - start;
    // 加载未结束（end 仍为 0）、无耗时、无字节数时不采样：
    // 保留上一次有效值，避免把 0 或 Infinity 写进窗口
    if (!(timeLoading > 0) || !(bytes > 0)) {
      return;
    }
    // 与 hls.js 内部带宽估计一致：扣掉首字节时间（TTFB），只保留实际传输耗时
    const ttfb = first > start ? first - start : 0;
    const transferTime = timeLoading - ttfb;
    const duration = (transferTime > 0 ? transferTime : timeLoading) / 1000;
    const speed = bytes / duration;
    if (!Number.isFinite(speed) || speed <= 0) {
      return;
    }
    const now = performance.now();
    this.downloadSpeedSamples.push({ time: now, speed });
    this.pruneDownloadSpeedSamples(now);
  }

  /**
   * 丢弃采样窗口之外的样本
   *
   * @param now - 当前时刻（`performance.now()`）
   */
  private pruneDownloadSpeedSamples(now: number): void {
    const samples = this.downloadSpeedSamples;
    while (
      samples.length > 0 &&
      now - samples[0].time > Hls.DOWNLOAD_SPEED_WINDOW_MS
    ) {
      samples.shift();
    }
  }

  /**
   * 分片加载完成 → 记录下载速度（内部使用）
   */
  private onFragLoadedForDownloadSpeed(
    event: Events.FRAG_LOADED,
    data: FragLoadedData,
  ): void {
    // 低延迟 HLS 下数据可能由 part 承载；取值方式与 abr-controller 保持一致
    // （注意 FragLoadedData 本身没有 stats 字段，stats 挂在 frag / part 上）
    const stats = data.part
      ? data.part.stats
      : data.frag
        ? data.frag.stats
        : undefined;
    this.recordDownloadSpeed(stats);
  }

  /**
   * 清单加载完成 → 记录下载速度（内部使用）
   */
  private onLevelLoadedForDownloadSpeed(
    event: Events.LEVEL_LOADED,
    data: LevelLoadedData,
  ): void {
    this.recordDownloadSpeed(data.stats);
  }

  once<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener: HlsListeners[E],
    context: Context = this as any,
  ) {
    this._emitter.once(event, listener, context);
  }

  removeAllListeners<E extends keyof HlsListeners>(event?: E | undefined) {
    this._emitter.removeAllListeners(event);
  }

  off<E extends keyof HlsListeners, Context = undefined>(
    event: E,
    listener?: HlsListeners[E] | undefined,
    context: Context = this as any,
    once?: boolean | undefined,
  ) {
    this._emitter.off(event, listener, context, once);
  }

  listeners<E extends keyof HlsListeners>(event: E): HlsListeners[E][] {
    return this._emitter.listeners(event);
  }

  emit<E extends keyof HlsListeners>(
    event: E,
    name: E,
    eventObject: Parameters<HlsListeners[E]>[1],
  ): boolean {
    return this._emitter.emit(event, name, eventObject);
  }

  trigger<E extends keyof HlsListeners>(
    event: E,
    eventObject: Parameters<HlsListeners[E]>[1],
  ): boolean {
    if (this.config.debug) {
      return this.emit(event, event, eventObject);
    } else {
      try {
        return this.emit(event, event, eventObject);
      } catch (error) {
        this.logger.error(
          'An internal error happened while handling event ' +
            event +
            '. Error message: "' +
            error.message +
            '". Here is a stacktrace:',
          error,
        );
        // Prevent recursion in error event handlers that throw #5497
        if (!this.triggeringException) {
          this.triggeringException = true;
          const fatal = event === Events.ERROR;
          this.trigger(Events.ERROR, {
            type: ErrorTypes.OTHER_ERROR,
            details: ErrorDetails.INTERNAL_EXCEPTION,
            fatal,
            event,
            error,
          });
          this.triggeringException = false;
        }
      }
    }
    return false;
  }

  listenerCount<E extends keyof HlsListeners>(event: E): number {
    return this._emitter.listenerCount(event);
  }

  /**
   * Dispose of the instance
   */
  destroy() {
    this.logger.log('destroy');
    this.trigger(Events.DESTROYING, undefined);
    this.detachMedia();
    this.removeAllListeners();
    this._autoLevelCapping = -1;
    this._url = null;
    // 清空下载速度采样，避免销毁后残留与内存泄漏
    this.downloadSpeedSamples.length = 0;

    this.networkControllers.forEach((component) => component.destroy());
    this.networkControllers.length = 0;

    this.coreComponents.forEach((component) => component.destroy());
    this.coreComponents.length = 0;

    this.iframeController = undefined;

    // Remove any references that could be held in config options or callbacks
    const config = this.config;
    config.xhrSetup = config.fetchSetup = undefined;
    // @ts-ignore
    this.userConfig = null;
  }

  /**
   * Attaches Hls.js to a media element
   */
  attachMedia(data: HTMLMediaElement | MediaAttachingData) {
    if (!data || ('media' in data && !data.media)) {
      const error = new Error(`attachMedia failed: invalid argument (${data})`);
      this.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.ATTACH_MEDIA_ERROR,
        fatal: true,
        error,
      });
      return;
    }
    this.logger.log(`attachMedia`);
    if (this._media) {
      this.logger.warn(`media must be detached before attaching`);
      this.detachMedia();
    }
    const attachMediaSource = 'media' in data;
    const media = attachMediaSource ? data.media : data;
    const attachingData = attachMediaSource ? data : { media };
    this._media = media;
    this.trigger(Events.MEDIA_ATTACHING, attachingData);
  }

  /**
   * Detach Hls.js from the media
   */
  detachMedia() {
    this.logger.log('detachMedia');
    const data = {};
    this.trigger(Events.MEDIA_DETACHING, data);
    this._media = null;
    this.trigger(Events.MEDIA_DETACHED, data);
  }

  /**
   * Detach HTMLMediaElement, MediaSource, and SourceBuffers without reset, for attaching to another instance
   */
  transferMedia(): AttachMediaSourceData | null {
    this._media = null;
    const transferMedia = this.bufferController.transferMedia();
    const data = { transferMedia };
    this.trigger(Events.MEDIA_DETACHING, data);
    this.trigger(Events.MEDIA_DETACHED, data);
    return transferMedia;
  }

  /**
   * Set the source URL. Can be relative or absolute.
   */
  loadSource(url: string) {
    this.stopLoad();
    const media = this.media;
    const loadedSource = this._url;
    const loadingSource = (this._url = buildAbsoluteURL(
      self.location.href,
      url,
      {
        alwaysNormalize: true,
      },
    ));
    this._autoLevelCapping = -1;
    this._maxHdcpLevel = null;
    this.logger.log(`loadSource:${loadingSource}`);
    if (
      media &&
      loadedSource &&
      (loadedSource !== loadingSource || this.bufferController.hasSourceTypes())
    ) {
      // Remove and re-create MediaSource
      this.detachMedia();
      this.attachMedia(media);
    }
    // when attaching to a source URL, trigger a playlist load
    this.trigger(Events.MANIFEST_LOADING, { url: url });
  }

  /**
   * 直接注入预解析的清单对象，零网络请求、零 m3u8 文本。
   */
  loadManifest(
    variants: ManifestVariant[],
    audioGroups: ManifestAudioGroup[] = [],
    url: string = 'internal://manifest',
  ): void {
    this.stopLoad();
    const media = this.media;
    const loadedSource = this._url;
    const loadingSource = (this._url = url);
    this._autoLevelCapping = -1;
    this._maxHdcpLevel = null;
    this.logger.log(`loadManifest:${loadingSource}`);

    if (
      media &&
      loadedSource &&
      (loadedSource !== loadingSource || this.bufferController.hasSourceTypes())
    ) {
      this.detachMedia();
      this.attachMedia(media);
    }

    const levels: LevelParsed[] = variants.map((v, i) =>
      this._variantToLevelParsed(v, i),
    );
    const audioTracks: MediaPlaylist[] = audioGroups.map((g, i) =>
      this._audioGroupToMediaPlaylist(g, i),
    );

    // 触发 MANIFEST_LOADED，启动官方事件链：
    // → LevelController.onManifestLoaded → 创建 Level（保留 details）
    // → MANIFEST_PARSED → StreamController.levels = data.levels
    this.trigger(Events.MANIFEST_LOADED, {
      levels,
      audioTracks,
      subtitles: [],
      captions: [],
      iframeVariants: [],
      url: loadingSource,
      stats: new LoadStats(),
      networkDetails: null,
      contentSteering: null,
      sessionData: null,
      sessionKeys: null,
      startTimeOffset: null,
      variableList: null,
    });

    // MANIFEST_LOADED 后 LevelController 会按 height/bitrate 排序 levels，
    // 导致排序后的 level index 与 _buildLevelDetails 中设置的 frag.level 不一致。
    // 必须在排序后更新所有 fragment 的 level 属性，否则 getCurrentContext
    // 会用错误的 level index 查找，导致返回 null（视频 BUFFER_CODECS 不触发）。
    for (let i = 0; i < this.levels.length; i++) {
      const details = this.levels[i]?.details;
      if (details) {
        for (const frag of details.fragments) {
          frag.level = i;
        }
        for (const frag of details.encryptedFragments) {
          frag.level = i;
        }
      }
    }

    // 同样更新音频 track 的 fragment level
    for (let i = 0; i < this.audioTracks.length; i++) {
      const details = this.audioTracks[i]?.details;
      if (details) {
        for (const frag of details.fragments) {
          frag.level = i;
        }
        for (const frag of details.encryptedFragments) {
          frag.level = i;
        }
      }
    }

    // 使用 startLoad(0) 设置 startPosition=0（VOD 从头开始）。
    // 必须在 LEVEL_LOADED/LEVEL_UPDATED 之前调用，设置 started=true，
    // 这样 interstitials-controller 的 startLoadingPrimaryAt 中
    // hls.loadingEnabled 为 true，不会重复调用 hls.startLoad()。
    this.startLoad(0);

    const stats = new LoadStats();

    // 只对当前 level 触发 LEVEL_LOADED，其他 level 触发 LEVEL_UPDATED。
    // LEVEL_LOADED 会触发 onLevelLoaded → set levelLastLoaded + setStartPosition + tick()，
    // 这些是 stream-controller 开始加载分片的必要条件。
    // 但 onLevelLoaded 中 abortCurrentFrag 会在 fragCurrent.level !== data.level 时
    // 中止正在加载的分片，所以只能触发一次 LEVEL_LOADED（当前 level）。
    const currentLevelIndex = this.nextLoadLevel;
    const currentLevel = this.levels[currentLevelIndex];
    if (currentLevel?.details && !currentLevel.details.live) {
      this.trigger(Events.LEVEL_LOADED, {
        details: currentLevel.details,
        levelInfo: currentLevel,
        level: currentLevelIndex,
        id: 0,
        stats,
        networkDetails: null,
        deliveryDirectives: null,
        withoutMultiVariant: true,
      });
    }

    // 其他 level 只触发 LEVEL_UPDATED（供 interstitials-controller 等使用）。
    for (let i = 0; i < levels.length; i++) {
      if (i === currentLevelIndex) continue;
      const level = this.levels[i];
      if (level?.details && !level.details.live) {
        this.trigger(Events.LEVEL_UPDATED, {
          details: level.details,
          level: i,
        });
      }
    }

    // 直接触发 AUDIO_TRACK_LOADED（音频只有一个 track，不会 abortCurrentFrag）。
    for (let i = 0; i < audioTracks.length; i++) {
      const track = this.audioTracks[i];
      if (track?.details && !track.details.live) {
        this.trigger(Events.AUDIO_TRACK_LOADED, {
          details: track.details,
          track,
          id: i,
          groupId: track.groupId,
          stats,
          networkDetails: null,
          deliveryDirectives: null,
        });
      }
    }

    // ---- 6. 不再手动触发 INIT_PTS_FOUND ----
    // 在 M3U8 正常路径下，INIT_PTS_FOUND 由 stream-controller 在视频分片 transmux 完成后触发，
    // 音频流控制器等待 INIT_PTS_FOUND 后再开始加载音频分片，确保使用正确的 initPTS（含正确的 timescale）。
    // 之前手动触发 INIT_PTS_FOUND 使用 timescale:1，而实际 fMP4 的 timescale 是 60000，
    // 导致音频在视频 transmux 之前就使用错误的 timescale 进行 transmux，
    // 可能引发前几秒画面重叠问题。现在移除手动触发，让音频流控制器等待视频 PTS。
  }

  /**
   * Gets the currently loaded URL
   */
  public get url(): string | null {
    return this._url;
  }

  /**
   * Whether or not enough has been buffered to seek to start position or use `media.currentTime` to determine next load position
   */
  get hasEnoughToStart(): boolean {
    return this.streamController.hasEnoughToStart;
  }

  /**
   * Get the startPosition set on startLoad(position) or on autostart with config.startPosition
   */
  get startPosition(): number {
    return this.streamController.startPositionValue;
  }

  /**
   * Start loading data from the stream source.
   * Depending on default config, client starts loading automatically when a source is set.
   *
   * @param startPosition - Set the start position to stream from.
   * Defaults to -1 (None: starts from earliest point)
   */
  startLoad(startPosition: number = -1, skipSeekToStartPosition?: boolean) {
    this.logger.log(
      `startLoad(${
        startPosition +
        (skipSeekToStartPosition ? ', <skip seek to start>' : '')
      })`,
    );
    this.started = true;
    this.resumeBuffering();
    for (let i = 0; i < this.networkControllers.length; i++) {
      this.networkControllers[i].startLoad(
        startPosition,
        skipSeekToStartPosition,
      );
      if (!this.started || !this.networkControllers) {
        break;
      }
    }
  }

  /**
   * Stop loading of any stream data.
   */
  stopLoad() {
    this.logger.log('stopLoad');
    this.started = false;
    for (let i = 0; i < this.networkControllers.length; i++) {
      this.networkControllers[i].stopLoad();
      if (this.started || !this.networkControllers) {
        break;
      }
    }
  }

  /**
   * Returns whether loading, toggled with `startLoad()` and `stopLoad()`, is active or not`.
   */
  get loadingEnabled(): boolean {
    return this.started;
  }

  /**
   * Returns state of fragment loading toggled by calling `pauseBuffering()` and `resumeBuffering()`.
   */
  get bufferingEnabled(): boolean {
    return this.streamController.bufferingEnabled;
  }

  /**
   * Resumes stream controller segment loading after `pauseBuffering` has been called.
   */
  resumeBuffering() {
    if (!this.bufferingEnabled) {
      this.logger.log(`resume buffering`);
      this.networkControllers.forEach((controller) => {
        if (controller.resumeBuffering) {
          controller.resumeBuffering();
        }
      });
    }
  }

  /**
   * Prevents stream controller from loading new segments until `resumeBuffering` is called.
   * This allows for media buffering to be paused without interupting playlist loading.
   */
  pauseBuffering() {
    if (this.bufferingEnabled) {
      this.logger.log(`pause buffering`);
      this.networkControllers.forEach((controller) => {
        if (controller.pauseBuffering) {
          controller.pauseBuffering();
        }
      });
    }
  }

  get inFlightFragments(): InFlightFragments {
    const inFlightData = {
      [PlaylistLevelType.MAIN]: this.streamController.inFlightFrag,
    };
    if (this.audioStreamController) {
      inFlightData[PlaylistLevelType.AUDIO] =
        this.audioStreamController.inFlightFrag;
    }
    if (this.subtititleStreamController) {
      inFlightData[PlaylistLevelType.SUBTITLE] =
        this.subtititleStreamController.inFlightFrag;
    }
    return inFlightData;
  }

  /**
   * Swap through possible audio codecs in the stream (for example to switch from stereo to 5.1)
   */
  swapAudioCodec() {
    this.logger.log('swapAudioCodec');
    this.streamController.swapAudioCodec();
  }

  /**
   * When the media-element fails, this allows to detach and then re-attach it
   * as one call (convenience method).
   *
   * Automatic recovery of media-errors by this process is configurable.
   */
  recoverMediaError() {
    this.logger.log('recoverMediaError');
    const media = this._media;
    const started = this.started;
    const time = media?.currentTime;
    this.detachMedia();
    if (media) {
      this.attachMedia(media);
      if (started) {
        if (time) {
          this.startLoad(time);
        } else if (!this.config.autoStartLoad) {
          this.startLoad();
        }
      }
    }
  }

  removeLevel(levelIndex: number) {
    this.levelController.removeLevel(levelIndex);
  }

  /**
   * @returns a UUID for this player instance
   */
  get sessionId(): string {
    let _sessionId = this._sessionId;
    if (!_sessionId) {
      _sessionId = this._sessionId = uuid();
    }
    return _sessionId;
  }

  /**
   * @returns an array of levels (variants) sorted by HDCP-LEVEL, RESOLUTION (height), FRAME-RATE, CODECS, VIDEO-RANGE, and BANDWIDTH
   */
  get levels(): Level[] {
    const levels = this.levelController.levels;
    return levels ? levels : [];
  }

  /**
   * @returns LevelDetails of last loaded level (variant) or `null` prior to loading a media playlist.
   */
  get latestLevelDetails(): LevelDetails | null {
    return this.streamController.getLevelDetails() || null;
  }

  /**
   * @returns Level object of selected level (variant) or `null` prior to selecting a level or once the level is removed.
   */
  get loadLevelObj(): Level | null {
    return this.levelController.loadLevelObj;
  }

  /**
   * Index of quality level (variant) currently played
   */
  get currentLevel(): number {
    return this.streamController.currentLevel;
  }

  /**
   * Set quality level index immediately. This will flush the current buffer to replace the quality asap. That means playback will interrupt at least shortly to re-buffer and re-sync eventually. Set to -1 for automatic level selection.
   */
  set currentLevel(newLevel: number) {
    this.logger.log(`set currentLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.immediateLevelSwitch();
  }

  /**
   * Index of next quality level loaded as scheduled by stream controller.
   */
  get nextLevel(): number {
    return this.streamController.nextLevel;
  }

  /**
   * Set quality level index for next loaded data.
   * This will switch the video quality asap, without interrupting playback.
   * May abort current loading of data, and flush parts of buffer (outside currently played fragment region).
   * @param newLevel - Pass -1 for automatic level selection
   */
  set nextLevel(newLevel: number) {
    this.logger.log(`set nextLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.nextLevelSwitch();
  }

  /**
   * Return the quality level of the currently or last (of none is loaded currently) segment
   */
  get loadLevel(): number {
    return this.levelController.level;
  }

  /**
   * Set quality level index for next loaded data in a conservative way.
   * This will switch the quality without flushing, but interrupt current loading.
   * Thus the moment when the quality switch will appear in effect will only be after the already existing buffer.
   * @param newLevel - Pass -1 for automatic level selection
   */
  set loadLevel(newLevel: number) {
    this.logger.log(`set loadLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
  }

  /**
   * get next quality level loaded
   */
  get nextLoadLevel(): number {
    return this.levelController.nextLoadLevel;
  }

  /**
   * Set quality level of next loaded segment in a fully "non-destructive" way.
   * Same as `loadLevel` but will wait for next switch (until current loading is done).
   */
  set nextLoadLevel(level: number) {
    this.levelController.nextLoadLevel = level;
  }

  /**
   * Return "first level": like a default level, if not set,
   * falls back to index of first level referenced in manifest
   */
  get firstLevel(): number {
    return Math.max(this.levelController.firstLevel, this.minAutoLevel);
  }

  /**
   * Sets "first-level", see getter.
   */
  set firstLevel(newLevel: number) {
    this.logger.log(`set firstLevel:${newLevel}`);
    this.levelController.firstLevel = newLevel;
  }

  /**
   * Return the desired start level for the first fragment that will be loaded.
   * The default value of -1 indicates automatic start level selection.
   * Setting hls.nextAutoLevel without setting a startLevel will result in
   * the nextAutoLevel value being used for one fragment load.
   */
  get startLevel(): number {
    const startLevel = this.levelController.startLevel;
    if (startLevel === -1 && this.abrController.forcedAutoLevel > -1) {
      return this.abrController.forcedAutoLevel;
    }
    return startLevel;
  }

  /**
   * set  start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   */
  set startLevel(newLevel: number) {
    this.logger.log(`set startLevel:${newLevel}`);
    // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel, this.minAutoLevel);
    }

    this.levelController.startLevel = newLevel;
  }

  /**
   * Whether level capping is enabled.
   * Default value is set via `config.capLevelToPlayerSize`.
   */
  get capLevelToPlayerSize(): boolean {
    return this.config.capLevelToPlayerSize;
  }

  /**
   * Enables or disables level capping. If disabled after previously enabled, `nextLevelSwitch` will be immediately called.
   */
  set capLevelToPlayerSize(shouldStartCapping: boolean) {
    const newCapLevelToPlayerSize = !!shouldStartCapping;

    if (newCapLevelToPlayerSize !== this.config.capLevelToPlayerSize) {
      if (newCapLevelToPlayerSize) {
        this.capLevelController.startCapping(); // If capping occurs, nextLevelSwitch will happen based on size.
      } else {
        this.capLevelController.stopCapping();
        this.autoLevelCapping = -1;
        this.streamController.nextLevelSwitch(); // Now we're uncapped, get the next level asap.
      }

      this.config.capLevelToPlayerSize = newCapLevelToPlayerSize;
    }
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   */
  get autoLevelCapping(): number {
    return this._autoLevelCapping;
  }

  /**
   * Returns the current bandwidth estimate in bits per second, when available. Otherwise, `NaN` is returned.
   */
  get bandwidthEstimate(): number {
    const { bwEstimator } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.getEstimate();
  }

  set bandwidthEstimate(abrEwmaDefaultEstimate: number) {
    this.abrController.resetEstimator(abrEwmaDefaultEstimate);
  }

  get abrEwmaDefaultEstimate(): number {
    const { bwEstimator } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.defaultEstimate;
  }

  /**
   * get time to first byte estimate
   * @type {number}
   */
  get ttfbEstimate(): number {
    const { bwEstimator } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.getEstimateTTFB();
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   */
  set autoLevelCapping(newLevel: number) {
    if (this._autoLevelCapping !== newLevel) {
      this.logger.log(`set autoLevelCapping:${newLevel}`);
      this._autoLevelCapping = newLevel;
      this.levelController.checkMaxAutoUpdated();
    }
  }

  get maxHdcpLevel(): HdcpLevel {
    return this._maxHdcpLevel;
  }

  set maxHdcpLevel(value: HdcpLevel) {
    if (isHdcpLevel(value) && this._maxHdcpLevel !== value) {
      this._maxHdcpLevel = value;
      this.levelController.checkMaxAutoUpdated();
    }
  }

  /**
   * True when automatic level selection enabled
   */
  get autoLevelEnabled(): boolean {
    return this.levelController.manualLevel === -1;
  }

  /**
   * Level set manually (if any)
   */
  get manualLevel(): number {
    return this.levelController.manualLevel;
  }

  /**
   * min level selectable in auto mode according to config.minAutoBitrate
   */
  get minAutoLevel(): number {
    const {
      levels,
      config: { minAutoBitrate },
    } = this;
    if (!levels) return 0;

    const len = levels.length;
    for (let i = 0; i < len; i++) {
      if (levels[i].maxBitrate >= minAutoBitrate) {
        return i;
      }
    }

    return 0;
  }

  /**
   * max level selectable in auto mode according to autoLevelCapping
   */
  get maxAutoLevel(): number {
    const { levels, autoLevelCapping, maxHdcpLevel } = this;

    let maxAutoLevel;
    if (autoLevelCapping === -1 && levels?.length) {
      maxAutoLevel = levels.length - 1;
    } else {
      maxAutoLevel = autoLevelCapping;
    }

    if (maxHdcpLevel) {
      for (let i = maxAutoLevel; i--; ) {
        const hdcpLevel = levels[i].attrs['HDCP-LEVEL'];
        if (hdcpLevel && hdcpLevel <= maxHdcpLevel) {
          return i;
        }
      }
    }

    return maxAutoLevel;
  }

  get firstAutoLevel(): number {
    return this.abrController.firstAutoLevel;
  }

  /**
   * next automatically selected quality level
   */
  get nextAutoLevel(): number {
    return this.abrController.nextAutoLevel;
  }

  /**
   * this setter is used to force next auto level.
   * this is useful to force a switch down in auto mode:
   * in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
   * forced value is valid for one fragment. upon successful frag loading at forced level,
   * this value will be resetted to -1 by ABR controller.
   */
  set nextAutoLevel(nextLevel: number) {
    this.abrController.nextAutoLevel = nextLevel;
  }

  /**
   * get the datetime value relative to media.currentTime for the active level Program Date Time if present
   */
  public get playingDate(): Date | null {
    return this.streamController.currentProgramDateTime;
  }

  public get mainForwardBufferInfo(): BufferInfo | null {
    return this.streamController.getMainFwdBufferInfo();
  }

  public get maxBufferLength(): number {
    return this.streamController.maxBufferLength;
  }

  /**
   * Find and select the best matching audio track, making a level switch when a Group change is necessary.
   * Updates `hls.config.audioPreference`. Returns the selected track, or null when no matching track is found.
   */
  public setAudioOption(
    audioOption: MediaPlaylist | AudioSelectionOption | undefined,
  ): MediaPlaylist | null {
    return this.audioTrackController?.setAudioOption(audioOption) || null;
  }
  /**
   * Find and select the best matching subtitle track, making a level switch when a Group change is necessary.
   * Updates `hls.config.subtitlePreference`. Returns the selected track, or null when no matching track is found.
   */
  public setSubtitleOption(
    subtitleOption: MediaPlaylist | SubtitleSelectionOption | undefined,
  ): MediaPlaylist | null {
    return (
      this.subtitleTrackController?.setSubtitleOption(subtitleOption) || null
    );
  }

  /**
   * Get the complete list of audio tracks across all media groups
   */
  get allAudioTracks(): MediaPlaylist[] {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.allAudioTracks : [];
  }

  /**
   * Get the list of selectable audio tracks
   */
  get audioTracks(): MediaPlaylist[] {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTracks : [];
  }

  /**
   * index of the selected audio track (index in audio track lists)
   */
  get audioTrack(): number {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTrack : -1;
  }

  /**
   * selects an audio track, based on its index in audio track lists
   */
  set audioTrack(audioTrackId: number) {
    const audioTrackController = this.audioTrackController;
    if (audioTrackController) {
      audioTrackController.audioTrack = audioTrackId;
    }
  }

  /**
   * Index of next audio track as scheduled by audio stream controller.
   */
  get nextAudioTrack(): number {
    return this.audioStreamController?.nextAudioTrack ?? -1;
  }

  /**
   * Set audio track index for next loaded data.
   * This will switch the audio track asap, without interrupting playback.
   * May abort current loading of data, and flush parts of buffer(outside
   * currently played fragment region). Audio Track Switched event will be
   * delayed until the currently playing fragment is of the next audio track.
   * @param audioTrackId - Pass -1 for automatic level selection
   */
  set nextAudioTrack(audioTrackId: number) {
    const { audioTrackController } = this;
    if (audioTrackController) {
      audioTrackController.nextAudioTrack = audioTrackId;
    }
  }

  /**
   * get the complete list of subtitle tracks across all media groups
   */
  get allSubtitleTracks(): MediaPlaylist[] {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController
      ? subtitleTrackController.allSubtitleTracks
      : [];
  }

  /**
   * get alternate subtitle tracks list from playlist
   */
  get subtitleTracks(): MediaPlaylist[] {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController
      ? subtitleTrackController.subtitleTracks
      : [];
  }

  /**
   * index of the selected subtitle track (index in subtitle track lists)
   */
  get subtitleTrack(): number {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
  }

  get media() {
    return this._media;
  }

  /**
   * select an subtitle track, based on its index in subtitle track lists
   */
  set subtitleTrack(subtitleTrackId: number) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleTrack = subtitleTrackId;
    }
  }

  /**
   * Whether subtitle display is enabled or not
   */
  get subtitleDisplay(): boolean {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController
      ? subtitleTrackController.subtitleDisplay
      : false;
  }

  /**
   * Enable/disable subtitle display rendering
   */
  set subtitleDisplay(value: boolean) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleDisplay = value;
    }
  }

  /**
   * get mode for Low-Latency HLS loading
   */
  get lowLatencyMode(): boolean {
    return this.config.lowLatencyMode;
  }

  /**
   * Enable/disable Low-Latency HLS part playlist and segment loading, and start live streams at playlist PART-HOLD-BACK rather than HOLD-BACK.
   */
  set lowLatencyMode(mode: boolean) {
    this.config.lowLatencyMode = mode;
  }

  /**
   * Position (in seconds) of live sync point (ie edge of live position minus safety delay defined by ```hls.config.liveSyncDuration```)
   * @returns null prior to loading live Playlist
   */
  get liveSyncPosition(): number | null {
    return this.latencyController?.liveSyncPosition ?? null;
  }

  /**
   * Estimated position (in seconds) of live edge (ie edge of live playlist plus time sync playlist advanced)
   * @returns 0 before first playlist is loaded
   */
  get latency(): number {
    return this.latencyController?.latency || 0;
  }

  /**
   * maximum distance from the edge before the player seeks forward to ```hls.liveSyncPosition```
   * configured using ```liveMaxLatencyDurationCount``` (multiple of target duration) or ```liveMaxLatencyDuration```
   * @returns 0 before first playlist is loaded
   */
  get maxLatency(): number {
    return this.latencyController?.maxLatency || 0;
  }

  /**
   * target distance from the edge as calculated by the latency controller
   */
  get targetLatency(): number | null {
    return this.latencyController?.targetLatency || null;
  }

  set targetLatency(latency: number) {
    if (!this.latencyController) return;
    this.latencyController.targetLatency = latency;
  }

  /**
   * the rate at which the edge of the current live playlist is advancing or 1 if there is none
   */
  get drift(): number | null {
    return this.latencyController?.drift || null;
  }

  /**
   * set to true when startLoad is called before MANIFEST_PARSED event
   */
  get forceStartLoad(): boolean {
    return this.streamController.forceStartLoad;
  }

  /**
   * ContentSteering pathways getter
   */
  get pathways(): string[] {
    return this.levelController.pathways;
  }

  /**
   * ContentSteering pathwayPriority getter/setter
   */
  get pathwayPriority(): string[] | null {
    return this.levelController.pathwayPriority;
  }

  set pathwayPriority(pathwayPriority: string[]) {
    this.levelController.pathwayPriority = pathwayPriority;
  }

  /**
   * returns true when all SourceBuffers are buffered to the end
   */
  get bufferedToEnd(): boolean {
    return !!this.bufferController?.bufferedToEnd;
  }

  /**
   * returns Interstitials Program Manager
   */
  get interstitialsManager(): InterstitialsManager | null {
    if (__USE_INTERSTITIALS__ && this.interstitialsController) {
      return this.interstitialsController.interstitialsManager;
    }
    return null;
  }

  /**
   * returns an array of parsed iframe variants
   */
  get iframeVariants(): LevelParsed[] {
    const iframeVariants = this.levelController.iframeVariants;
    return iframeVariants ? iframeVariants : [];
  }

  /**
   * Returns an new iframe focused Hls (HlsIFramesOnly) instance based on `iframeVariants` found in the current asset,
   * or null when none are available. An iframe instance uses iframe variants as its `levels`.
   * Use HlsIFramesOnly.loadMediaAt(time) to render video IFrames in an attached video element.
   */
  createIFramePlayer(
    configOverride?: Partial<HlsConfig>,
  ): HlsIFramesOnly | null {
    if (__USE_IFRAMES__ && this._url && this.iframeController) {
      return this.iframeController.createIFramePlayer(configOverride);
    }
    return null;
  }

  /**
   * returns mediaCapabilities.decodingInfo for a variant/rendition
   */
  getMediaDecodingInfo(
    level: Level,
    audioTracks: MediaPlaylist[] = this.allAudioTracks,
  ): Promise<MediaDecodingInfo> {
    const audioTracksByGroup = getAudioTracksByGroup(audioTracks);
    return getMediaDecodingInfoPromise(
      level,
      audioTracksByGroup,
      navigator.mediaCapabilities,
    );
  }

  // ==========================================================================
  // loadManifest 辅助方法 —— 将外部输入对象转换为 hls.js 内部数据结构
  // ==========================================================================

  /**
   * 将 ManifestVariant 转换为 LevelParsed。
   *
   * 构造 AttrList（模拟 #EXT-X-STREAM-INF 属性），
   * 如果 variant.playlistDetails 存在，则构造完整的 LevelDetails（含 Fragment[]），
   * 使得 LevelController 创建 Level 时即可携带 details，
   * 后续无需触发 LEVEL_LOADING 网络请求。
   */
  private _variantToLevelParsed(
    variant: ManifestVariant,
    index: number,
  ): LevelParsed {
    // 构造 HLS 属性字典（模拟 #EXT-X-STREAM-INF 标签属性）
    const attrs: Record<string, string> = {
      BANDWIDTH: String(variant.bandwidth),
    };
    if (variant.codecs) {
      attrs.CODECS = variant.codecs;
    }
    if (variant.resolution) {
      attrs.RESOLUTION = `${variant.resolution.width}x${variant.resolution.height}`;
    }
    if (variant.frameRate !== undefined) {
      attrs['FRAME-RATE'] = String(variant.frameRate);
    }
    if (variant.audioGroupId) {
      attrs.AUDIO = variant.audioGroupId;
    }

    // 解析 codecs 字符串，分离 videoCodec 和 audioCodec
    const codecs = parseCodecs(variant.codecs ?? '');

    // 如果有分片详情，构造 LevelDetails（含完整 Fragment[]）
    let details: LevelDetails | undefined;
    if (variant.playlistDetails) {
      details = this._buildLevelDetails(
        variant.playlistDetails,
        variant.url,
        index,
        PlaylistLevelType.MAIN,
      );
    }

    return {
      attrs: new AttrList(attrs),
      bitrate: variant.bandwidth,
      name: variant.name ?? `${variant.resolution?.height ?? 0}p`,
      url: variant.url,
      videoCodec: codecs.videoCodec,
      audioCodec: codecs.audioCodec,
      id: index,
      width: variant.resolution?.width,
      height: variant.resolution?.height,
      details,
    };
  }

  /**
   * 将 ManifestAudioGroup 转换为 MediaPlaylist。
   *
   * 构造符合 HLS #EXT-X-MEDIA TYPE=AUDIO 语义的属性字典，
   * 如果 audioGroup.playlistDetails 存在则构造 LevelDetails。
   */
  private _audioGroupToMediaPlaylist(
    group: ManifestAudioGroup,
    index: number,
  ): MediaPlaylist {
    const attrs: Record<string, string> = {
      TYPE: 'AUDIO',
      'GROUP-ID': group.groupId,
      NAME: group.name ?? `Audio ${index + 1}`,
      DEFAULT: group.default ? 'YES' : 'NO',
      AUTOSELECT: group.autoselect ? 'YES' : 'NO',
      URI: group.url,
    };
    if (group.channels) {
      attrs.CHANNELS = group.channels;
    }
    if (group.lang) {
      attrs.LANGUAGE = group.lang;
    }

    const codecs = parseCodecs(group.codecs ?? '');

    let details: LevelDetails | undefined;
    if (group.playlistDetails) {
      details = this._buildLevelDetails(
        group.playlistDetails,
        group.url,
        index,
        PlaylistLevelType.AUDIO,
      );
    }

    const result: MediaPlaylist = {
      attrs: new AttrList(attrs) as MediaPlaylist['attrs'],
      bitrate: group.bandwidth ?? 0,
      id: index,
      groupId: group.groupId,
      name: group.name ?? `Audio ${index + 1}`,
      type: 'AUDIO' as const,
      url: group.url,
      default: group.default ?? false,
      autoselect: group.autoselect ?? false,
      forced: false,
      audioCodec: codecs.audioCodec,
      channels: group.channels,
      lang: group.lang,
      details,
    };
    return result;
  }

  /**
   * 将 ManifestPlaylistDetails 转换为 LevelDetails（含完整 Fragment[] 和可选的 init segment）。
   *
   * 这是对象注入模式的核心方法——模拟 M3U8Parser.parseLevelPlaylist() 的输出，
   * 直接构造 Fragment 对象填充到 LevelDetails.fragments 中。
   * 后续 StreamController 通过 getNextFragment() 遍历 fragments 加载分片。
   *
   * @param playlist  - 用户提供的分片描述
   * @param baseUrl   - 分片 URL 的基础路径
   * @param levelIndex - 所属 level 的索引
   * @param type      - MAIN 或 AUDIO
   */
  private _buildLevelDetails(
    playlist: ManifestPlaylistDetails,
    baseUrl: string,
    levelIndex: number,
    type: PlaylistLevelType,
  ): LevelDetails {
    const details = new LevelDetails(baseUrl);
    details.live = playlist.live ?? false;
    details.targetduration = playlist.targetDuration ?? 4;
    const startSN = playlist.mediaSequence ?? 0;
    details.startSN = startSN;

    let initSeg: Fragment | null = null;
    if (playlist.initSegmentUrl) {
      initSeg = new Fragment(type, baseUrl);
      initSeg.sn = 'initSegment';
      initSeg.level = levelIndex;
      initSeg.relurl = playlist.initSegmentUrl;
      /* 单文件模式（SegmentBase）：init 段也是同一个文件里的一个字节范围 */
      if (playlist.initSegmentRange) {
        initSeg.setByteRange(playlist.initSegmentRange);
      }
      initSeg.setStart(0);
      initSeg.playlistOffset = 0;
    }

    // 构建 AES-128 加密的 LevelKey（对应 #EXT-X-KEY:METHOD=AES-128）
    let levelkeys: { [key: string]: LevelKey } | undefined;
    if (playlist.encryption) {
      const enc = playlist.encryption;
      const keyFormat = enc.keyFormat ?? 'identity';
      const keyFormatVersions = enc.keyFormatVersions
        ? enc.keyFormatVersions.split('/').map(Number).filter(Number.isFinite)
        : [1];
      const iv = enc.iv
        ? new Uint8Array(hexToArrayBuffer(enc.iv))
        : null;
      const levelKey = new LevelKey(
        'AES-128',
        enc.keyUrl,
        keyFormat,
        keyFormatVersions,
        iv,
      );
      levelkeys = { identity: levelKey };
    }

    // 遍历分片列表，逐个创建 Fragment 对象并计算累积时间
    const segments = playlist.segments ?? [];
    let cumTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const frag = new Fragment(type, baseUrl);
      frag.sn = startSN + i;
      frag.level = levelIndex;
      frag.cc = 0;
      frag.duration = seg.duration;
      frag.setStart(cumTime);
      frag.playlistOffset = cumTime;
      // 只设置 relurl，让 url getter 通过 buildAbsoluteURL(baseurl, relurl) 自动拼接绝对路径
      // 直接设置 frag.url 会绕过绝对路径解析，相对路径分片请求将失败
      frag.relurl = seg.url;
      /* 单文件模式（SegmentBase）：分片也是同一个文件的字节范围，与 M3U8Parser 解析
         #EXT-X-BYTERANGE 走同一条 setByteRange（只给长度时接着上一段的结束位置续算） */
      if (seg.byteRange) {
        frag.setByteRange(seg.byteRange, i > 0 ? details.fragments[details.fragments.length - 1] : undefined);
      }
      frag.initSegment = initSeg;
      // 设置加密密钥（对应 M3U8Parser 中 setFragLevelKeys 的行为）
      if (levelkeys) {
        frag.levelkeys = levelkeys;
      }
      // 非直播流仅最后一个分片标记 endList（与 M3U8Parser 行为一致）
      frag.endList = !details.live && i === segments.length - 1;
      if (isMediaFragment(frag)) {
        details.fragments.push(frag);
        // 跟踪加密分片（与 M3U8Parser 中 setFragLevelKeys 的行为一致）
        if (levelkeys) {
          details.encryptedFragments.push(frag);
        }
      }
      cumTime += seg.duration;
    }

    details.totalduration = cumTime;
    details.endSN = startSN + segments.length - 1;
    details.updated = false;

    // 计算 averagetargetduration（与 M3U8Parser 行为一致，影响 ABR 等级切换决策）
    const fragmentLength = details.fragments.length;
    if (cumTime > 0 && fragmentLength) {
      details.averagetargetduration = cumTime / fragmentLength;
    }

    // 设置 endCC（与 M3U8Parser 行为一致）
    details.endCC = 0;

    return details;
  }
}

export type InFlightFragments = {
  [PlaylistLevelType.MAIN]: InFlightData;
  [PlaylistLevelType.AUDIO]?: InFlightData;
  [PlaylistLevelType.SUBTITLE]?: InFlightData;
};
export type {
  AudioSelectionOption,
  SubtitleSelectionOption,
  VideoSelectionOption,
  MediaPlaylist,
  ErrorDetails,
  ErrorTypes,
  Events,
  Level,
  LevelDetails,
  HlsListeners,
  HlsEventEmitter,
  HlsConfig,
  BufferInfo,
  BufferTimeRange,
  HdcpLevel,
  AbrController,
  AudioStreamController,
  AudioTrackController,
  BasePlaylistController,
  BaseStreamController,
  BufferController,
  CapLevelController,
  CMCDController,
  ContentSteeringController,
  EMEController,
  ErrorController,
  FPSController,
  GapController,
  IFrameController,
  HlsIFramesOnly,
  InterstitialsController,
  LatencyController,
  StreamController,
  SubtitleStreamController,
  SubtitleTrackController,
  EwmaBandWidthEstimator,
  InterstitialsManager,
  Decrypter,
  FragmentLoader,
  KeyLoader,
  TaskLoop,
  TransmuxerInterface,
  InFlightData,
  State,
  BaseLoader,
  XhrLoader,
  FetchLoader,
  Cues,
  M3U8Parser,
};
export type {
  ABRControllerConfig,
  PlaylistControllerConfig,
  BufferControllerConfig,
  CapLevelControllerConfig,
  CMCDControllerConfig,
  EMEControllerConfig,
  DRMSystemConfiguration,
  DRMSystemsConfiguration,
  DRMSystemOptions,
  FPSControllerConfig,
  FragmentLoaderConfig,
  FragmentLoaderConstructor,
  GapControllerConfig,
  HlsLoadPolicies,
  LevelControllerConfig,
  LoaderConfig,
  LoadPolicy,
  MP4RemuxerConfig,
  PlaylistLoaderConfig,
  PlaylistLoaderConstructor,
  RetryConfig,
  SelectionPreferences,
  StreamControllerConfig,
  LatencyControllerConfig,
  MetadataControllerConfig,
  TimelineControllerConfig,
  TSDemuxerConfig,
} from './config';
export type {
  GenerateRequestFilterResult,
  KeyRequests,
  KeyStatuses,
  KeyTimeouts,
  LicenseAndKeysRequest,
  LicenseRequestReason,
  MediaKeySessionContext,
} from './controller/eme-controller';
export type {
  FragmentState,
  FragmentTracker,
} from './controller/fragment-tracker';
export type {
  PathwayClone,
  SteeringManifest,
  UriReplacement,
} from './controller/content-steering-controller';
export type {
  NetworkErrorAction,
  ErrorActionFlags,
  IErrorAction,
} from './controller/error-controller';
export type { ID3TrackController } from './controller/id3-track-controller';
export type {
  HlsAssetPlayer,
  HlsAssetPlayerConfig,
  InterstitialPlayer,
} from './controller/interstitial-player';
export type { PlayheadTimes } from './controller/interstitials-controller';
export type {
  InterstitialScheduleDurations,
  InterstitialScheduleEventItem,
  InterstitialScheduleItem,
  InterstitialSchedulePrimaryItem,
} from './controller/interstitials-schedule';
export type { TimelineController } from './controller/timeline-controller';
export type { DecrypterAesMode } from './crypt/decrypter-aes-mode';
export type { DateRange, DateRangeCue } from './loader/date-range';
export type { LoadStats } from './loader/load-stats';
export type { LevelKey } from './loader/level-key';
export type {
  Base,
  BaseSegment,
  EncryptedFragment,
  Fragment,
  MediaFragment,
  Part,
  MediaFragmentRef,
  ElementaryStreams,
  ElementaryStreamTypes,
  ElementaryStreamInfo,
} from './loader/fragment';
export type {
  FragLoadFailResult,
  FragmentLoadProgressCallback,
  LoadError,
} from './loader/fragment-loader';
export type { KeyLoaderInfo } from './loader/key-loader';
export type { DecryptData } from './loader/level-key';
export type {
  AssetListJSON,
  BaseData,
  InterstitialAssetId,
  InterstitialAssetItem,
  InterstitialEvent,
  InterstitialEventWithAssetList,
  InterstitialId,
  PlaybackRestrictions,
  SnapOptions,
  TimelineOccupancy,
} from './loader/interstitial-event';
export type {
  ParsedMultivariantPlaylist,
  ParsedMultivariantMediaOptions,
} from './loader/m3u8-parser';
export type {
  AttachMediaSourceData,
  BaseTrack,
  BaseTrackSet,
  BufferCreatedTrack,
  BufferCreatedTrackSet,
  ExtendedSourceBuffer,
  MediaOverrides,
  ParsedTrack,
  SourceBufferName,
  SourceBufferListener,
  SourceBufferTrack,
  SourceBufferTrackSet,
} from './types/buffer';
export type {
  ComponentAPI,
  AbrComponentAPI,
  NetworkComponentAPI,
} from './types/component-api';
export type {
  TrackLoadingData,
  TrackLoadedData,
  AssetListLoadedData,
  AssetListLoadingData,
  AudioTrackLoadedData,
  AudioTrackUpdatedData,
  AudioTracksUpdatedData,
  AudioTrackSwitchedData,
  AudioTrackSwitchingData,
  BackBufferData,
  BufferAppendedData,
  BufferAppendingData,
  BufferCodecsData,
  BufferCreatedData,
  BufferEOSData,
  BufferFlushedData,
  BufferFlushingData,
  CuesParsedData,
  ErrorData,
  FPSDropData,
  FPSDropLevelCappingData,
  FragBufferedData,
  FragChangedData,
  FragDecryptedData,
  FragLoadedData,
  FragLoadEmergencyAbortedData,
  FragLoadingData,
  FragParsedData,
  FragParsingInitSegmentData,
  FragParsingMetadataData,
  FragParsingUserdataData,
  InitPTSFoundData,
  KeyLoadedData,
  KeyLoadingData,
  LevelLoadedData,
  LevelLoadingData,
  LevelPTSUpdatedData,
  LevelsUpdatedData,
  LevelSwitchedData,
  LevelSwitchingData,
  LevelUpdatedData,
  LiveBackBufferData,
  ContentSteeringOptions,
  ManifestLoadedData,
  ManifestLoadingData,
  ManifestParsedData,
  MaxAutoLevelUpdatedData,
  MediaAttachedData,
  MediaAttachingData,
  MediaDetachedData,
  MediaDetachingData,
  MediaEndedData,
  NonNativeTextTrack,
  NonNativeTextTracksData,
  PartsLoadedData,
  SteeringManifestLoadedData,
  SubtitleFragProcessedData,
  SubtitleTrackLoadedData,
  SubtitleTrackUpdatedData,
  SubtitleTracksUpdatedData,
  SubtitleTrackSwitchData,
  InterstitialsUpdatedData,
  InterstitialsBufferedToBoundaryData,
  InterstitialAssetPlayerCreatedData,
  InterstitialStartedData,
  InterstitialEndedData,
  InterstitialAssetStartedData,
  InterstitialAssetEndedData,
  InterstitialAssetErrorData,
  InterstitialsPrimaryResumed,
} from './types/events';
export type {
  MetadataSample,
  MetadataSchema,
  UserdataSample,
} from './types/demuxer';
export type {
  InitSegmentData,
  RemuxedMetadata,
  RemuxedTrack,
  RemuxedUserdata,
  RemuxerResult,
} from './types/remuxer';
export type {
  NetworkDetails,
  NullableNetworkDetails,
} from './types/network-details';
export type { AttrList } from './utils/attr-list';
export type { Bufferable } from './utils/buffer-helper';
export type { CaptionScreen } from './utils/cea-608-parser';
export type { CuesInterface } from './utils/cues';
export type {
  CodecsParsed,
  HdcpLevels,
  HlsSkip,
  HlsUrlParameters,
  LevelAttributes,
  LevelParsed,
  VariableMap,
  VideoRange,
  VideoRangeValues,
} from './types/level';
export type {
  PlaylistLevelType,
  LoaderContextType,
  HlsChunkPerformanceTiming,
  HlsPerformanceTiming,
  HlsProgressivePerformanceTiming,
  PlaylistContextType,
  PlaylistLoaderContext,
  FragmentLoaderContext,
  KeyLoaderContext,
  Loader,
  LoaderStats,
  LoaderContext,
  LoaderResponse,
  LoaderConfiguration,
  LoaderCallbacks,
  LoaderOnProgress,
  LoaderOnAbort,
  LoaderOnError,
  LoaderOnSuccess,
  LoaderOnTimeout,
} from './types/loader';
export type { ILogFunction, ILogger, Logger } from './utils/logger';
export type {
  MediaAttributes,
  MediaPlaylistType,
  MainPlaylistType,
  AudioPlaylistType,
  SubtitlePlaylistType,
} from './types/media-playlist';
export type { Track, TrackSet } from './types/track';
export type { ChunkMetadata, TransmuxerResult } from './types/transmuxer';
export type { MediaDecodingInfo } from './utils/mediacapabilities-helper';
export type {
  MediaKeyFunc,
  KeySystems,
  KeySystemFormats,
} from './utils/mediakeys-helper';
export type {
  RationalTimestamp,
  TimestampOffset,
} from './utils/timescale-conversion';

// ==========================================================================
// loadManifest 输入类型接口
// ==========================================================================

/**
 * loadManifest 方法的变体流输入接口
 *
 * 描述一个视频变体流（对应 HLS 的 #EXT-X-STREAM-INF），
 * 可包含内嵌的播放列表分片信息（playlistDetails）。
 * 如果不提供 playlistDetails，则 Level 仅有元数据而无分片信息，
 * 后续 hls.js 会尝试通过 url 发起 LEVEL_LOADING 网络请求加载媒体播放列表。
 */
export interface ManifestVariant {
  /** 带宽（bps），必填 */
  bandwidth: number;
  /** 变体流 URL（指向 m3u8 或直接指向分片的基础路径） */
  url: string;
  /** 编码格式字符串，如 "avc1.4d401f,mp4a.40.2" */
  codecs?: string;
  /** 分辨率 */
  resolution?: { width: number; height: number };
  /** 帧率，如 59.94 */
  frameRate?: number;
  /** 关联的音频组 ID（对应 #EXT-X-MEDIA TYPE=AUDIO 的 GROUP-ID） */
  audioGroupId?: string;
  /** 变体名称（可选，用于日志和显示） */
  name?: string;
  /** 内嵌的播放列表分片信息（提供后零网络请求直接启播） */
  playlistDetails?: ManifestPlaylistDetails;
}

/**
 * loadManifest 方法的音频轨道输入接口
 *
 * 描述一个音频轨道（对应 HLS 的 #EXT-X-MEDIA TYPE=AUDIO），
 * 可包含内嵌的播放列表分片信息。
 */
export interface ManifestAudioGroup {
  /** 音频组 ID（对应 AUDIO 属性的值） */
  groupId: string;
  /** 音频轨道 URL */
  url: string;
  /** 编码格式字符串，如 "mp4a.40.2" */
  codecs?: string;
  /** 音频轨道名称 */
  name?: string;
  /** 语言标识，如 "en"、"zh" */
  lang?: string;
  /** 声道数，如 "2" 表示立体声 */
  channels?: string;
  /** 带宽（bps），可选 */
  bandwidth?: number;
  /** 是否为默认轨道 */
  default?: boolean;
  /** 是否自动选择 */
  autoselect?: boolean;
  /** 内嵌的播放列表分片信息（提供后零网络请求直接启播） */
  playlistDetails?: ManifestPlaylistDetails;
}

/**
 * AES-128 分片加密配置接口
 *
 * 描述 HLS #EXT-X-KEY:METHOD=AES-128 标签的加密参数，
 * 用于对象注入模式下替代 m3u8 文本中的加密标签。
 */
export interface ManifestEncryption {
  /** 密钥获取 URL（对应 #EXT-X-KEY:URI） */
  keyUrl: string;
  /** 初始化向量（16 字节 hex 编码，对应 #EXT-X-KEY:IV=0x...），不传时使用分片序号作为 IV */
  iv?: string;
  /** 密钥格式标识（对应 #EXT-X-KEY:KEYFORMAT），默认 "identity" */
  keyFormat?: string;
  /** 密钥格式版本（对应 #EXT-X-KEY:KEYFORMATVERSIONS） */
  keyFormatVersions?: string;
}

/**
 * 播放列表分片信息接口
 *
 * 描述一个媒体播放列表的分片结构（对应 HLS 的 Media Playlist），
 * 包含初始化段和媒体分片列表。
 * 这是对象注入模式的核心数据结构——替代了 m3u8 文本解析的结果。
 */
export interface ManifestPlaylistDetails {
  /** 目标分片时长（秒），默认 4 */
  targetDuration?: number;
  /** 是否为直播流，默认 false（点播） */
  live?: boolean;
  /** 初始化段 URL（fMP4 的 init segment） */
  initSegmentUrl?: string;
  /**
   * 初始化段的字节范围，HLS 记法「长度@起点」（如 "820@0"）；
   * 对应 `#EXT-X-MAP:URI="…",BYTERANGE="…"`。
   * 单文件（SegmentBase / mode='single'）模式下 init 与媒体段都在同一个文件里，靠它定位。
   */
  initSegmentRange?: string;
  /** 媒体序列号起始值（对应 #EXT-X-MEDIA-SEQUENCE），默认 0 */
  mediaSequence?: number;
  /** 媒体分片列表 */
  segments?: ManifestSegment[];
  /** AES-128 分片加密配置（对应 #EXT-X-KEY:METHOD=AES-128） */
  encryption?: ManifestEncryption;
}

/**
 * 媒体分片接口
 *
 * 描述单个媒体分片（对应 HLS 的 #EXTINF 标签 + 分片 URL）。
 */
export interface ManifestSegment {
  /** 分片时长（秒） */
  duration: number;
  /** 分片 URL（相对或绝对路径，指向 .ts 或 .m4s 文件） */
  url: string;
  /**
   * 分片字节范围，HLS 记法「长度@起点」（如 "587314@908"），对应 `#EXT-X-BYTERANGE`；
   * 只给长度（"587314"）时接着上一分片的结束位置续算。单文件模式下多个分片指向同一个文件。
   */
  byteRange?: string;
}

// ==========================================================================
// loadManifest 工具函数
// ==========================================================================

/**
 * 解析 codecs 字符串，分离视频编码和音频编码。
 *
 * hls.js 内部使用 LevelParsed.videoCodec 和 LevelParsed.audioCodec
 * 分别判断编解码器兼容性，因此需要将逗号分隔的 codecs 字符串拆分。
 *
 * 例如输入 "avc1.4d401f,mp4a.40.2" 返回
 * { videoCodec: "avc1.4d401f", audioCodec: "mp4a.40.2" }
 */
function parseCodecs(codecs: string): {
  videoCodec?: string;
  audioCodec?: string;
} {
  const parts = codecs.split(',').map((c) => c.trim());
  let videoCodec: string | undefined;
  let audioCodec: string | undefined;

  for (const codec of parts) {
    if (
      codec.startsWith('avc') ||
      codec.startsWith('hev') ||
      codec.startsWith('hvc') ||
      codec.startsWith('vp0') ||
      codec.startsWith('vp8') ||
      codec.startsWith('vp9') ||
      codec.startsWith('av0') ||
      codec.startsWith('av1')
    ) {
      videoCodec = codec;
    } else if (codec) {
      audioCodec = codec;
    }
  }

  return { videoCodec, audioCodec };
}
