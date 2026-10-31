package com.nemethon.assistmanager

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Проверки логики виджета (запускаются при каждой сборке в GitHub Actions). */
class WidgetLogicTest {

    @Test
    fun levelsFollowStreakThresholds() {
        val expected = mapOf(0 to 0, 1 to 1, 2 to 1, 3 to 2, 6 to 2, 7 to 3, 14 to 4, 30 to 5, 60 to 6, 100 to 7, 200 to 8, 364 to 8, 365 to 9, 999 to 9)
        for ((streak, level) in expected) assertEquals("серия $streak", level, WidgetLogic.levelOf(streak))
        assertEquals(10, WidgetLogic.LEVEL_NAMES.size)
    }

    @Test
    fun shiftCrossesMonthYearAndLeapDay() {
        assertEquals("2026-02-28", WidgetLogic.shift("2026-03-01", -1))
        assertEquals("2026-01-01", WidgetLogic.shift("2025-12-31", 1))
        assertEquals("2028-02-29", WidgetLogic.shift("2028-03-01", -1))
        assertEquals("2026-10-30", WidgetLogic.shift("2026-10-31", -1))
    }

    @Test
    fun sameDaySnapshotIsShownAsIs() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-31", 5, 2, 3, false), "2026-10-31")
        assertEquals(5, d.streak)
        assertEquals(2, d.left)
        assertEquals(3, d.total)
        assertEquals(2, d.level)
        assertFalse(d.allDone)
        assertFalse(d.extinguished)
    }

    @Test
    fun allHabitsDoneToday() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-31", 8, 0, 3, true), "2026-10-31")
        assertTrue(d.allDone)
        assertEquals("Всё сделано. Огонь доволен", WidgetLogic.subtitle(d, true))
    }

    @Test
    fun newDayKeepsStreakIfYesterdayWasCompleted() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-30", 7, 0, 3, true), "2026-10-31")
        assertEquals(7, d.streak)
        assertEquals(3, d.left)       // новый день — снова осталось всё
        assertEquals(3, d.level)
        assertFalse(d.extinguished)
        assertFalse(d.allDone)
    }

    @Test
    fun streakBurnsIfYesterdayWasNotCompleted() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-30", 7, 1, 3, false), "2026-10-31")
        assertEquals(0, d.streak)
        assertEquals(0, d.level)
        assertTrue(d.extinguished)
        assertEquals("Огонь погас. Зажги заново", WidgetLogic.subtitle(d, true))
    }

    @Test
    fun oldSnapshotMeansBurnedStreak() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-20", 12, 0, 3, true), "2026-10-31")
        assertEquals(0, d.streak)
        assertTrue(d.extinguished)
    }

    @Test
    fun neverSyncedShowsHint() {
        val d = WidgetLogic.resolve(Snapshot("", 0, 0, 0, false), "2026-10-31")
        assertEquals(0, d.streak)
        assertFalse(d.extinguished)
        assertEquals("Открой приложение, чтобы зажечь огонь", WidgetLogic.subtitle(d, false))
    }

    @Test
    fun leftTextAndPlural() {
        val d = WidgetLogic.resolve(Snapshot("2026-10-31", 2, 1, 3, false), "2026-10-31")
        assertEquals("Осталось: 1 из 3", WidgetLogic.subtitle(d, true))
        assertEquals("день", WidgetLogic.plural(1))
        assertEquals("дня", WidgetLogic.plural(2))
        assertEquals("дней", WidgetLogic.plural(5))
        assertEquals("дней", WidgetLogic.plural(11))
        assertEquals("дня", WidgetLogic.plural(22))
        assertEquals("дней", WidgetLogic.plural(0))
    }
}
