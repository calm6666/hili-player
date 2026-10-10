/**
 * ============================================
 * 音效工具函数
 * ============================================
 * dB / 增益换算、干湿信号电平计算、有限数值判定
 */

/**
 * 判断数值是否为有限数（非 NaN / 非 Infinity）
 * 类型谓词形式，用于在分支中收窄类型
 *
 * @param value - 待判定数值
 * @returns 是否为有限数
 */
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * dB 转线性增益
 * 公式：gain = 10^(db/20)
 *
 * @param db - 分贝值
 * @returns 线性增益（0~N）
 */
export const db2gain = (db: number): number => Math.pow(10, db / 20);

/**
 * 线性增益转 dB
 * 公式：db = 20 * log10(gain)
 *
 * @param gain - 线性增益
 * @returns 分贝值
 */
export const gain2db = (gain: number): number => 20 * Math.log10(gain);

/**
 * 根据干湿混合比例计算干信号电平
 * 干信号（原始输入）电平随混合比增大而衰减
 *
 * @param mix - 干湿混合比例（0~1），0=全干信号，1=全湿信号
 * @returns 干信号电平（0~1）
 */
export const getDryLevel = (mix: number): number => 1 - mix;

/**
 * 根据干湿混合比例计算湿信号电平
 * 湿信号（效果输出）电平随混合比增大而提升
 *
 * @param mix - 干湿混合比例（0~1），0=全干信号，1=全湿信号
 * @returns 湿信号电平（0~1）
 */
export const getWetLevel = (mix: number): number => mix;
