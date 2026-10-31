package com.nemethon.assistmanager

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Плагин-мост для виджета нужно зарегистрировать до super.onCreate
        registerPlugin(WidgetBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
