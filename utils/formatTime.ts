/**
 * ============================================
 * 时间格式化工具函数
 * ============================================
 * 提供视频播放时间格式化的功能
 * 将秒数转换为时:分:秒或分:秒的格式
 */

/**
 * 格式化时间显示
 * 将秒数转换为可读的时分秒格式
 *
 * @param seconds - 需要格式化的秒数
 * @returns 格式化后的时间字符串
 *
 * @example
 * formatTime(65)     // 返回 "01:05"
 * formatTime(3665)   // 返回 "1:01:05"
 * formatTime(0)      // 返回 "00:00"
 *
 * @description
 * 当时间超过1小时时，返回格式为 "H:MM:SS"
 * 当时间不足1小时时，返回格式为 "MM:SS"
 * 分钟和秒数始终保证两位数显示
 */
export function formatTime(seconds: number): string {
    // 创建Date对象，将秒数转换为毫秒
    // 使用UTC时间避免时区影响
    const date = new Date(seconds * 1000);

    // 获取小时数
    const hours = date.getUTCHours();

    // 获取分钟数，并格式化为两位数（不足两位前面补0）
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    // 获取秒数，并格式化为两位数（不足两位前面补0）
    const secondsFormatted = date.getUTCSeconds().toString().padStart(2, '0');

    // 判断是否有小时部分
    if (hours > 0) {
        // 超过1小时，返回完整格式：时:分:秒
        return `${hours}:${minutes}:${secondsFormatted}`;
    } else {
        // 不足1小时，返回简写格式：分:秒
        return `${minutes}:${secondsFormatted}`;
    }
}
