/**
 * SVG 标签集合
 * 用于编译期识别 SVG 元素，跳过运行时 Set 查找
 */
export const SVG_TAGS = new Set<string>([
  // 容器元素
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "switch",
  "foreignObject",
  // 图形元素
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "image",
  // 文本元素
  "text",
  "tspan",
  "textPath",
  "title",
  "desc",
  "metadata",
  // 渐变元素
  "linearGradient",
  "radialGradient",
  "stop",
  // 裁剪与遮罩
  "clipPath",
  "mask",
  "pattern",
  "marker",
  // 滤镜元素
  "filter",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feFlood",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "feSpecularLighting",
  "feTile",
  "feTurbulence",
  "feDistantLight",
  "fePointLight",
  "feSpotLight",
  // 动画元素
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "mpath",
]);
