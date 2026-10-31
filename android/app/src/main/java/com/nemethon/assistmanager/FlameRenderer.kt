package com.nemethon.assistmanager

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader

/** Рисует огонёк для виджета: тот же силуэт и цвета уровней, что и на главном экране приложения. */
object FlameRenderer {
    // Три цвета на уровень: основание, середина, острие
    private val COLORS = arrayOf(
        arrayOf("#5a2a1c", "#8a3a1e", "#c4572a"),
        arrayOf("#d9481a", "#ff8a1f", "#ffd27a"),
        arrayOf("#e2501b", "#ff9a24", "#ffe08f"),
        arrayOf("#e8441a", "#ffa22a", "#fff0b0"),
        arrayOf("#ff3d24", "#ffb02e", "#fff6cf"),
        arrayOf("#ff5a1f", "#ffc244", "#bfe6ff"),
        arrayOf("#2f6bff", "#5fb2ff", "#e6f6ff"),
        arrayOf("#7a2cff", "#c35bff", "#ffe1ff"),
        arrayOf("#ff9d2e", "#ffe27a", "#ffffff"),
        arrayOf("#ffb02e", "#fff0a0", "#ffffff"),
    )
    // Относительная высота огня по уровням
    private val HEIGHTS = floatArrayOf(.30f, .42f, .52f, .62f, .70f, .76f, .80f, .84f, .88f, .92f)

    private fun blend(a: Int, b: Int, t: Float): Int {
        fun mix(x: Int, y: Int) = (x + (y - x) * t).toInt().coerceIn(0, 255)
        return Color.argb(
            mix(Color.alpha(a), Color.alpha(b)),
            mix(Color.red(a), Color.red(b)),
            mix(Color.green(a), Color.green(b)),
            mix(Color.blue(a), Color.blue(b)),
        )
    }

    private fun withAlpha(c: Int, alpha: Int): Int = Color.argb(alpha, Color.red(c), Color.green(c), Color.blue(c))

    // Контур языка пламени: x от -1 до 1, y от 0 до 1 (вверх), масштаб k
    private fun flamePath(cx: Float, by: Float, hw: Float, ht: Float, k: Float): Path {
        fun px(x: Float) = cx + x * hw * k
        fun py(y: Float) = by - y * ht * k
        return Path().apply {
            moveTo(px(0f), py(0f))
            cubicTo(px(-0.95f), py(0f), px(-1.05f), py(0.36f), px(-0.62f), py(0.60f))
            cubicTo(px(-0.40f), py(0.72f), px(-0.52f), py(0.86f), px(-0.40f), py(0.96f))
            cubicTo(px(-0.10f), py(0.84f), px(-0.02f), py(0.70f), px(0.10f), py(1.0f))
            cubicTo(px(0.28f), py(0.84f), px(0.62f), py(0.74f), px(0.66f), py(0.48f))
            cubicTo(px(0.98f), py(0.30f), px(0.80f), py(0f), px(0f), py(0f))
            close()
        }
    }

    fun draw(level: Int, size: Int): Bitmap {
        val lv = level.coerceIn(0, COLORS.size - 1)
        val cols = COLORS[lv].map { Color.parseColor(it) }
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val s = size.toFloat()
        val baseY = s * 0.92f
        val ht = s * 0.86f * (0.35f + HEIGHTS[lv] * 0.65f)
        val hw = ht * 0.42f
        val cx = s / 2f

        // свечение
        val gr = ht * 0.95f
        val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(cx, baseY - ht * 0.4f, gr, withAlpha(cols[1], 110), withAlpha(cols[0], 0), Shader.TileMode.CLAMP)
        }
        cv.drawCircle(cx, baseY - ht * 0.4f, gr, glow)

        // три слоя пламени: снаружи внутрь, от тёмного к светлому
        val scales = floatArrayOf(1.0f, 0.74f, 0.44f)
        for (i in 0..2) {
            val top = if (i < 2) cols[i + 1] else blend(cols[2], Color.WHITE, 0.4f)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(0f, baseY, 0f, baseY - ht * scales[i], cols[i], top, Shader.TileMode.CLAMP)
            }
            cv.drawPath(flamePath(cx, baseY, hw, ht, scales[i]), paint)
        }
        return bmp
    }
}
