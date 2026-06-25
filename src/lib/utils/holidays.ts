import { addDays, getDay, getMonth, getYear, isSameDay } from "date-fns";

export interface Holiday {
    date: Date;
    name: string;
    type: "FEDERAL" | "RELIGIOUS" | "OTHER";
}

// Helper to get Nth weekday of month
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
    const firstDay = new Date(year, month, 1);
    let count = 0;
    for (let i = 0; i < 31; i++) {
        const current = addDays(firstDay, i);
        if (getMonth(current) !== month) break;
        if (getDay(current) === weekday) {
            count++;
            if (count === n) return current;
        }
    }
    return firstDay; // Fallback
}

// Helper for Easter (Meeus/Jones/Butcher algorithm)
function getEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

// Module-private (Q-21-009): only `isHoliday` (below) consumes this; no external importers.
function getHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = [];

    // Fixed Date Holidays
    holidays.push({ date: new Date(year, 0, 1), name: "New Year's Day", type: "FEDERAL" });
    holidays.push({ date: new Date(year, 6, 4), name: "Independence Day", type: "FEDERAL" });
    holidays.push({ date: new Date(year, 10, 11), name: "Veterans Day", type: "FEDERAL" });
    holidays.push({ date: new Date(year, 11, 25), name: "Christmas Day", type: "RELIGIOUS" });

    // Floating Date Holidays (Federal)
    // MLK Jr Day (3rd Mon in Jan)
    holidays.push({ date: getNthWeekdayOfMonth(year, 0, 1, 3), name: "Martin Luther King Jr. Day", type: "FEDERAL" });
    // Presidents Day (3rd Mon in Feb)
    holidays.push({ date: getNthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day", type: "FEDERAL" });
    // Memorial Day (Last Mon in May)
    // Logic: Iterate backwards from May 31
    let memDay = new Date(year, 4, 31);
    while (getDay(memDay) !== 1) {
        memDay = addDays(memDay, -1);
    }
    holidays.push({ date: memDay, name: "Memorial Day", type: "FEDERAL" });
    // Labor Day (1st Mon in Sep)
    holidays.push({ date: getNthWeekdayOfMonth(year, 8, 1, 1), name: "Labor Day", type: "FEDERAL" });
    // Columbus Day (2nd Mon in Oct)
    holidays.push({ date: getNthWeekdayOfMonth(year, 9, 1, 2), name: "Columbus Day", type: "FEDERAL" });
    // Thanksgiving (4th Thu in Nov)
    holidays.push({ date: getNthWeekdayOfMonth(year, 10, 4, 4), name: "Thanksgiving Day", type: "FEDERAL" });

    // Religious (Easter Based)
    const easter = getEaster(year);
    holidays.push({ date: easter, name: "Easter Sunday", type: "RELIGIOUS" });
    holidays.push({ date: addDays(easter, -2), name: "Good Friday", type: "RELIGIOUS" });
    holidays.push({ date: addDays(easter, 1), name: "Easter Monday", type: "RELIGIOUS" }); // Often off in schools

    return holidays;
}

export function isHoliday(date: Date): Holiday | undefined {
    const year = getYear(date);
    const holidays = getHolidays(year);
    return holidays.find(h => isSameDay(h.date, date));
}
