package com.nemethon.assistmanager

import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale

/** То, что приложение в последний раз сообщило виджету. */
data class Snapshot(
    val date: String,        // день, на который верны цифры, «гггг-мм-дд»
    val streak: Int,         // серия на этот день (как на главном экране)
    val left: Int,           // сколько привычек осталось сегодня
    val total: Int,          // всего привычек
    val doneToday: Boolean,  // закрыт ли весь день
)

/** Что показать на виджете прямо сейчас. */
data class Display(
    val streak: Int,
    val left: Int,
    val total: Int,
    val level: Int,
    val allDone: Boolean,
    val extinguished: Boolean,   // серия сгорела, пока приложение не открывали
)

/** Чистая логика виджета без Android-классов — её проверяют обычные модульные тесты. */
object WidgetLogic {
    val LEVEL_NAMES = listOf(
        "Уголёк", "Искра", "Огонёк", "Костёр", "Пламя",
        "Горнило", "Синее пламя", "Плазма", "Звёздный жар", "Солнце",
    )
    private val LEVEL_MIN = intArrayOf(0, 1, 3, 7, 14, 30, 60, 100, 200, 365)

    fun levelOf(streak: Int): Int {
        var level = 0
        for (i in LEVEL_MIN.indices) if (streak >= LEVEL_MIN[i]) level = i
        return level
    }

    fun keyOf(c: Calendar): String = String.format(
        Locale.US, "%04d-%02d-%02d",
        c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH),
    )

    fun todayKey(): String = keyOf(GregorianCalendar())

    fun shift(key: String, days: Int): String {
        val (y, m, d) = key.split("-").map { it.toInt() }
        val c = GregorianCalendar(y, m - 1, d)
        c.add(Calendar.DAY_OF_MONTH, days)
        return keyOf(c)
    }

    /**
     * Приложение могли не открывать несколько дней, поэтому цифры из снимка пересчитываем на сегодня:
     *  - снимок за сегодня — показываем как есть;
     *  - за вчера и день был закрыт — серия жива, а сегодня всё ещё впереди;
     *  - иначе серия уже сгорела (заморозки виджет не знает — они подтянутся, когда откроешь приложение).
     */
    fun resolve(s: Snapshot, today: String): Display = when {
        s.date == today ->
            Display(s.streak, s.left, s.total, levelOf(s.streak), s.total > 0 && s.left == 0, false)
        s.date == shift(today, -1) && s.doneToday ->
            Display(s.streak, s.total, s.total, levelOf(s.streak), false, false)
        else ->
            Display(0, s.total, s.total, 0, false, s.streak > 0)
    }

    fun plural(n: Int): String {
        val a = n % 10
        val b = n % 100
        return when {
            a == 1 && b != 11 -> "день"
            a in 2..4 && (b < 12 || b > 14) -> "дня"
            else -> "дней"
        }
    }

    /** Подпись под числом серии. */
    fun subtitle(d: Display, synced: Boolean): String = when {
        !synced || d.total == 0 -> "Открой приложение, чтобы зажечь огонь"
        d.extinguished -> "Огонь погас. Зажги заново"
        d.allDone -> "Всё сделано. Огонь доволен"
        else -> "Осталось: ${d.left} из ${d.total}"
    }
}
