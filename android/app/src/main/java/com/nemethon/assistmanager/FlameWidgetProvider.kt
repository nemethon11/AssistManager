package com.nemethon.assistmanager

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** Виджет на рабочем столе: огонёк, серия и сколько привычек осталось. Нажатие открывает приложение. */
class FlameWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) manager.updateAppWidget(id, build(context))
    }

    companion object {
        const val PREFS = "assistmanager_widget"

        fun load(context: Context): Pair<Snapshot, Boolean> {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val date = p.getString("date", "") ?: ""
            val snap = Snapshot(
                date = date,
                streak = p.getInt("streak", 0),
                left = p.getInt("left", 0),
                total = p.getInt("total", 0),
                doneToday = p.getBoolean("done", false),
            )
            return Pair(snap, date.isNotEmpty())
        }

        fun build(context: Context): RemoteViews {
            val (snap, synced) = load(context)
            val d = WidgetLogic.resolve(snap, WidgetLogic.todayKey())
            val v = RemoteViews(context.packageName, R.layout.widget_flame)
            v.setImageViewBitmap(R.id.w_flame, FlameRenderer.draw(d.level, 220))
            v.setTextViewText(R.id.w_level, WidgetLogic.LEVEL_NAMES[d.level].uppercase())
            v.setTextViewText(R.id.w_streak, d.streak.toString())
            v.setTextViewText(R.id.w_unit, WidgetLogic.plural(d.streak) + " подряд")
            v.setTextViewText(R.id.w_sub, WidgetLogic.subtitle(d, synced))

            // Нажатие на любое место виджета открывает приложение
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launch != null) {
                val pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                v.setOnClickPendingIntent(R.id.w_root, pi)
            }
            return v
        }

        /** Перерисовать все виджеты (после того, как приложение прислало свежие цифры). */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, FlameWidgetProvider::class.java))
            for (id in ids) manager.updateAppWidget(id, build(context))
        }
    }
}
