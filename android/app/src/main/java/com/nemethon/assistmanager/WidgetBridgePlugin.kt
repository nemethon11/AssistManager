package com.nemethon.assistmanager

import android.content.Context
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** Мост между веб-частью и виджетом: приложение присылает цифры, мы сохраняем их и перерисовываем виджет. */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val prefs = context.getSharedPreferences(FlameWidgetProvider.PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("date", call.getString("date", "") ?: "")
            .putInt("streak", call.getInt("streak", 0) ?: 0)
            .putInt("left", call.getInt("left", 0) ?: 0)
            .putInt("total", call.getInt("total", 0) ?: 0)
            .putBoolean("done", call.getBoolean("doneToday", false) ?: false)
            .apply()
        FlameWidgetProvider.refreshAll(context)
        call.resolve()
    }
}
