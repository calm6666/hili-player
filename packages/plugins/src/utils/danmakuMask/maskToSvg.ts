/**
 * 置信度 mask → SVG 平滑轮廓（marching-squares + 线性插值）
 * ============================================================
 * 把人像分割输出的**浮点置信度 mask**（0~1）转成 SVG 矢量轮廓：
 *
 * - 用 marching-squares 找边界，但交叉点不是取格子中点，而是按两侧置信度
 *   **线性插值**，因此轮廓平滑、贴合真实人形，不再是锯齿方块；
 * - 把「外框矩形 + 人物轮廓」放进同一个 <path> 的多个子路径，配合
 *   fill-rule="evenodd"，让人物区域成为透明镂空、背景保持黑色。
 *
 * 纯函数、无浏览器 API，可在分割 Worker 内直接调用。
 */

interface Point {
  x: number;
  y: number;
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** 把散段贪心链成若干折线 */
function chainSegments(segments: Array<[Point, Point]>): Point[][] {
  const remaining = segments.slice();
  const polylines: Point[][] = [];

  while (remaining.length > 0) {
    const first = remaining.shift();
    if (!first) break;
    const poly: Point[] = [first[0], first[1]];

    // 向前延伸
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const tail = poly[poly.length - 1];
        if (dist(tail, seg[0]) < 1e-6) {
          poly.push(seg[1]);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (dist(tail, seg[1]) < 1e-6) {
          poly.push(seg[0]);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    // 向后延伸
    extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const head = poly[0];
        if (dist(head, seg[0]) < 1e-6) {
          poly.unshift(seg[1]);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (dist(head, seg[1]) < 1e-6) {
          poly.unshift(seg[0]);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    polylines.push(poly);
  }

  return polylines;
}

/**
 * 把置信度 mask 转成「人物镂空、背景黑」的 SVG 轮廓。
 *
 * @param mask 置信度 mask（长度 = width * height，值域 0~1，1 表示人物）
 * @param width mask 宽度
 * @param height mask 高度
 * @param threshold 判定为「人物」的置信度阈值，默认 0.5
 */
export function maskToSvg(
  mask: Float32Array | number[],
  width: number,
  height: number,
  threshold = 0.5
): string {
  const at = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return mask[y * width + x] ?? 0;
  };

  const segments: Array<[Point, Point]> = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const v0 = at(x, y); // 左上
      const v1 = at(x + 1, y); // 右上
      const v2 = at(x + 1, y + 1); // 右下
      const v3 = at(x, y + 1); // 左下

      const crossings: Point[] = [];

      // 顶边 (v0 → v1)：交叉点按置信度线性插值
      if ((v0 >= threshold) !== (v1 >= threshold)) {
        const t = v1 === v0 ? 0.5 : (threshold - v0) / (v1 - v0);
        crossings.push({ x: x + t, y });
      }
      // 右边 (v1 → v2)
      if ((v1 >= threshold) !== (v2 >= threshold)) {
        const t = v2 === v1 ? 0.5 : (threshold - v1) / (v2 - v1);
        crossings.push({ x: x + 1, y: y + t });
      }
      // 底边 (v2 → v3)：从右往左
      if ((v2 >= threshold) !== (v3 >= threshold)) {
        const t = v3 === v2 ? 0.5 : (threshold - v2) / (v3 - v2);
        crossings.push({ x: x + 1 - t, y: y + 1 });
      }
      // 左边 (v3 → v0)：从下往上
      if ((v3 >= threshold) !== (v0 >= threshold)) {
        const t = v0 === v3 ? 0.5 : (threshold - v3) / (v0 - v3);
        crossings.push({ x, y: y + 1 - t });
      }

      if (crossings.length === 2) {
        segments.push([crossings[0], crossings[1]]);
      } else if (crossings.length === 4) {
        // 鞍点：按相邻顺序连接（上-右、下-左）
        segments.push([crossings[0], crossings[1]]);
        segments.push([crossings[2], crossings[3]]);
      }
    }
  }

  const polylines = chainSegments(segments);

  // 人物轮廓 path data
  const personPathData = polylines
    .map(poly => {
      const d = poly
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');
      return `${d} Z`;
    })
    .join(' ');

  // 关键：外框矩形 + 人物轮廓放在**同一个 <path>** 里，用 evenodd 让人物镂空
  const outerRect = `M0 0 H${width} V${height} H0 Z`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<path d="${outerRect} ${personPathData}" fill="black" fill-rule="evenodd"/>` +
    `</svg>`
  );
}
