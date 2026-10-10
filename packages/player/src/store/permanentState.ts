/**
 * 高能进度条常驻态（控制栏内跨组件共享）
 *
 * 设置面板的「高能进度条」勾选、`.nova-player-pbp-pin` 图钉点击、影子进度条的
 * 常驻形态三处必须同步；面板挂在 RightControls 下，与 Controls 不是父子直连，
 * 因此用一个轻量发布订阅作为唯一来源，避免逐层透传事件。
 */

type PermanentListener = (permanent: boolean) => void;

const listeners = new Set<PermanentListener>();

let permanent = false;

/** 读取当前常驻态 */
export function readPermanent(): boolean {
  return permanent;
}

/** 写入常驻态并广播（面板勾选 ↔ 图钉 ↔ 影子进度条三处同步） */
export function publishPermanent(value: boolean): void {
  permanent = value;
  listeners.forEach((listener) => listener(value));
}

/**
 * 订阅常驻态变化
 *
 * @param listener - 变化回调
 * @returns 取消订阅函数
 */
export function observePermanent(listener: PermanentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
