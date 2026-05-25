# 字幕处理系统 API 文档

一个支持主流字幕格式（SRT、ASS/SSA、WebVTT）的字幕处理系统，提供解析、生成、转换等功能。

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [字幕格式](#字幕格式)
- [字幕渲染](#字幕渲染)
- [示例代码](#示例代码)

## 特性

- 📄 **多格式支持**：SRT、ASS/SSA、WebVTT
- 🎨 **样式支持**：字体、颜色、描边、对齐等（ASS格式）
- 🔄 **格式转换**：支持不同格式间的相互转换
- 🎲 **随机生成**：生成测试字幕文件
- ⚡ **高性能**：优化的解析算法
- 🎯 **类型安全**：完整的 TypeScript 类型定义

## 快速开始

### 1. 解析字幕文件

```typescript
import { parseSubtitle, SubtitleFormat } from '@/utils/subtitle';

// 从文件读取字幕内容
const subtitleContent = await fetch('/subtitles/video.srt').then(r => r.text());

// 解析字幕
const subtitle = parseSubtitle(subtitleContent);

console.log('格式:', subtitle.format);
console.log('字幕数量:', subtitle.items.length);

// 遍历字幕项
subtitle.items.forEach(item => {
  console.log(`${item.id}: [${item.startTime}s - ${item.endTime}s] ${item.text}`);
});
```

### 2. 检测字幕格式

```typescript
import { detectSubtitleFormat, SubtitleFormat } from '@/utils/subtitle';

const format = detectSubtitleFormat(subtitleContent);

switch (format) {
  case SubtitleFormat.SRT:
    console.log('SRT 格式');
    break;
  case SubtitleFormat.ASS:
    console.log('ASS/SSA 格式');
    break;
  case SubtitleFormat.VTT:
    console.log('WebVTT 格式');
    break;
  default:
    console.log('未知格式');
}
```

### 3. 生成字幕文件

```typescript
import { generateSubtitleFile, SubtitleFormat } from '@/utils/subtitle';

// 生成随机字幕
const subtitleData = generateSubtitleFile({
  duration: 300,      // 5分钟视频
  count: 50,          // 50条字幕
  avgDuration: 3,     // 平均显示3秒
  language: 'zh',     // 中文
  includeStyles: true // 包含样式
});

// 转换为 SRT 格式
const srtContent = toSRT(subtitleData);
console.log(srtContent);
```

## API 参考

### 解析函数

#### `parseSubtitle(content: string): ParsedSubtitle`

自动检测并解析字幕文件。

```typescript
const subtitle = parseSubtitle(content);
// 返回: { format, items, globalStyle?, title? }
```

#### `parseSRT(content: string): ParsedSubtitle`

解析 SRT 格式字幕。

#### `parseASS(content: string): ParsedSubtitle`

解析 ASS/SSA 格式字幕。

#### `parseVTT(content: string): ParsedSubtitle`

解析 WebVTT 格式字幕。

### 生成函数

#### `generateSubtitleFile(config: SubtitleGeneratorConfig): ParsedSubtitle`

生成随机字幕数据。

```typescript
interface SubtitleGeneratorConfig {
  duration: number;        // 视频时长（秒）
  count: number;           // 字幕数量
  avgDuration?: number;    // 平均显示时长（秒），默认3秒
  language?: 'zh' | 'en' | 'mixed';  // 语言，默认'zh'
  includeStyles?: boolean; // 是否包含样式，默认false
}
```

### 转换函数

#### `toSRT(data: ParsedSubtitle): string`

将字幕数据转换为 SRT 格式。

#### `toASS(data: ParsedSubtitle): string`

将字幕数据转换为 ASS 格式。

#### `toVTT(data: ParsedSubtitle): string`

将字幕数据转换为 WebVTT 格式。

## 字幕格式

### SRT 格式

```
1
00:00:01,000 --> 00:00:03,000
这是第一条字幕

2
00:00:04,000 --> 00:00:06,000
这是第二条字幕
可以有多行
```

### ASS 格式

```
[Script Info]
Title: 测试字幕
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,这是第一条字幕
```

### WebVTT 格式

```
WEBVTT

00:00:01.000 --> 00:00:03.000
这是第一条字幕

00:00:04.000 --> 00:00:06.000
这是第二条字幕
```

## 字幕渲染

### SubtitleRenderer 组件

用于在视频播放器中渲染字幕。

```typescript
import { SubtitleRenderer } from '@/components/SubtitleRenderer';

// 使用字幕内容
<SubtitleRenderer
  subtitleContent={subtitleContent}
  currentTime={currentTime}
  fontScale={1.2}
/>

// 或使用字幕URL
<SubtitleRenderer
  subtitleUrl="/subtitles/video.srt"
  currentTime={currentTime}
/>
```

### Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| subtitleContent | string | 否 | 字幕文件内容 |
| subtitleUrl | string | 否 | 字幕文件URL |
| currentTime | number | 是 | 当前播放时间（秒） |
| fontScale | number | 否 | 字体缩放比例，默认1 |

### 样式支持

SubtitleRenderer 支持 ASS 格式的样式：
- 字体名称和大小
- 主颜色和描边颜色
- 粗体、斜体、下划线
- 对齐方式（底部居中、顶部等）
- 边距设置

## 示例代码

### 完整的视频播放器字幕集成

```typescript
import { useState, useEffect } from 'react';
import { parseSubtitle, SubtitleFormat } from '@/utils/subtitle';
import { SubtitleRenderer } from '@/components/SubtitleRenderer';

function VideoPlayerWithSubtitle() {
  const [subtitleContent, setSubtitleContent] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 加载字幕
  useEffect(() => {
    fetch('/subtitles/video.srt')
      .then(r => r.text())
      .then(setSubtitleContent);
  }, []);

  // 监听播放时间
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  return (
    <div className="video-container">
      <video ref={videoRef} src="/video.mp4" controls />
      <SubtitleRenderer
        subtitleContent={subtitleContent}
        currentTime={currentTime}
        fontScale={1.2}
      />
    </div>
  );
}
```

### 字幕格式转换

```typescript
import { parseSubtitle, toSRT, toASS, toVTT } from '@/utils/subtitle';

// 读取 ASS 字幕
const assContent = await fetch('/subtitles/video.ass').then(r => r.text());
const subtitle = parseSubtitle(assContent);

// 转换为 SRT
const srtContent = toSRT(subtitle);

// 转换为 WebVTT
const vttContent = toVTT(subtitle);

// 下载转换后的文件
const blob = new Blob([srtContent], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'video.srt';
a.click();
```

### 生成测试字幕

```typescript
import { generateSubtitleFile, toSRT, toASS, toVTT } from '@/utils/subtitle';

// 生成测试数据
const subtitleData = generateSubtitleFile({
  duration: 600,    // 10分钟
  count: 100,       // 100条字幕
  avgDuration: 4,   // 平均4秒
  language: 'mixed', // 中英文混合
  includeStyles: true
});

// 生成多种格式
const formats = {
  srt: toSRT(subtitleData),
  ass: toASS(subtitleData),
  vtt: toVTT(subtitleData)
};

// 下载所有格式
Object.entries(formats).forEach(([format, content]) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test.${format}`;
  a.click();
});
```

## 注意事项

1. **编码问题**：字幕文件建议使用 UTF-8 编码
2. **时间精度**：解析后的时间以秒为单位，保留3位小数
3. **多行文本**：ASS 和 VTT 格式支持多行文本，SRT 通过 `<br>` 实现
4. **样式兼容性**：SRT 不支持样式，ASS 样式最丰富

## 许可证

MIT License
