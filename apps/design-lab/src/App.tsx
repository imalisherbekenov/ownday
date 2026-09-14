import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Icon } from "./icons";
import {
  changeEntry,
  dates,
  dayStats,
  entryFor,
  habitRate,
  isDemoData,
  isDue,
  monday,
  seedData,
  shiftDate,
  streak,
  summary,
  titleFor,
  TODAY,
  STORAGE_KEY,
} from "./model";
import type { DemoData, Habit, Lang, Scenario, Variant } from "./model";

type View = "today" | "habits" | "progress" | "detail" | "website";
type LabState = {
  version: 1;
  variant: Variant;
  lang: Lang;
  dark: boolean;
  scenario: Scenario;
  datasets: Record<Scenario, DemoData>;
};
const scenarios: Scenario[] = ["daily", "new", "complete", "offline", "error"];
const freshState = (): LabState => ({
  version: 1,
  variant: "c",
  lang: "ru",
  dark: false,
  scenario: "daily",
  datasets: Object.fromEntries(scenarios.map((s) => [s, seedData(s)])) as Record<
    Scenario,
    DemoData
  >,
});
function readState(): LabState {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as LabState | null;
    if (
      state?.version === 1 &&
      ["a", "b", "c"].includes(state.variant) &&
      ["ru", "en"].includes(state.lang) &&
      typeof state.dark === "boolean" &&
      scenarios.includes(state.scenario) &&
      scenarios.every((s) => isDemoData(state.datasets?.[s]))
    )
      return state;
  } catch {
    /* A restricted browser or an old snapshot should still open the demo. */
  }
  return freshState();
}
type Translate = (ru: string, en: string) => string;
const formatDate = (date: string, lang: Lang, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function App() {
  const [state, setState] = useState(readState);
  const [view, setView] = useState<View>("today");
  const [date, setDate] = useState(TODAY);
  const [selectedId, setSelectedId] = useState("water");
  const [period, setPeriod] = useState<7 | 30>(7);
  const [createOpen, setCreateOpen] = useState(false);
  const [template, setTemplate] = useState<Partial<Habit> | undefined>();
  const [toast, setToast] = useState("");
  const [previous, setPrevious] = useState<{ scenario: Scenario; data: DemoData } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [retrySucceeded, setRetrySucceeded] = useState(false);
  const { lang, variant, dark, scenario } = state;
  const t: Translate = (ru, en) => (lang === "ru" ? ru : en);
  const data = state.datasets[scenario];
  const currentHabit = data.habits.find((h) => h.id === selectedId);
  const stat = dayStats(data, date);
  const names = {
    a: t("Тёплый минимализм", "Warm minimalism"),
    b: t("Точный инструмент", "Precision tool"),
    c: t("Живой дневник", "Living journal"),
  };
  const scenarioNames = {
    daily: t("Обычный день", "Everyday"),
    new: t("Новый пользователь", "First visit"),
    complete: t("Всё выполнено", "All done"),
    offline: t("Офлайн", "Offline"),
    error: t("Ошибка синхронизации", "Sync error"),
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    document.documentElement.lang = state.lang;
    document.documentElement.dataset.theme = state.dark ? "dark" : "light";
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast("");
      setPrevious(null);
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function updateData(next: DemoData) {
    setState((old) => ({ ...old, datasets: { ...old.datasets, [old.scenario]: next } }));
  }
  function mark(habit: Habit, action: "toggle" | "skip" | number, forDate = date) {
    setPrevious({ scenario, data });
    updateData(changeEntry(data, habit, forDate, action));
    setToast(
      action === "skip"
        ? t("День можно пропустить. Ритм сохранён.", "A pause is part of the rhythm.")
        : t("Сохранено на этом устройстве", "Saved on this device"),
    );
  }
  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openHabit(habit: Habit) {
    setSelectedId(habit.id);
    navigate("detail");
  }
  function openCreate(initial?: Partial<Habit>) {
    setTemplate(initial);
    setCreateOpen(true);
  }
  function chooseScenario(next: Scenario) {
    setRetrySucceeded(false);
    setState((old) => ({ ...old, scenario: next }));
    setDate(TODAY);
    setToast("");
    setPrevious(null);
    if (view === "detail") navigate("today");
  }
  function addHabit(habit: Habit) {
    updateData({ ...data, habits: [...data.habits, habit] });
    setCreateOpen(false);
    setDate(TODAY);
    navigate("today");
    setToast(t("Новая привычка — новое начало", "A new habit. A fresh start."));
  }
  const progress = summary(data, TODAY, 7);
  const navItems = [
    { id: "today" as const, icon: "sun", label: t("Сегодня", "Today") },
    { id: "habits" as const, icon: "grid", label: t("Привычки", "Habits") },
    { id: "progress" as const, icon: "chart", label: t("Прогресс", "Progress") },
  ];
  const renderNav = () =>
    navItems.map((item) => (
      <button
        key={item.id}
        className={`nav-item ${view === item.id || (view === "detail" && item.id === "habits") ? "active" : ""}`}
        aria-current={view === item.id ? "page" : undefined}
        onClick={() => navigate(item.id)}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </button>
    ));
  const visibleHabits = data.habits.filter((habit) => isDue(habit, date));
  const row = (habit: Habit) => (
    <HabitRow
      key={habit.id}
      habit={habit}
      data={data}
      date={date}
      lang={lang}
      t={t}
      onMark={mark}
      onOpen={openHabit}
    />
  );

  return (
    <div className={`lab variant-${variant} ${dark ? "theme-dark" : "theme-light"}`}>
      <a className="skip-link" href="#main-content">
        {t("Перейти к содержимому", "Skip to content")}
      </a>
      <header className="lab-header">
        <div className="lab-heading">
          <span className="lab-symbol">
            <Icon name="grid" size={16} />
          </span>
          <b>
            OWNDAY <span>DESIGN LAB</span>
          </b>
          <span className="demo-tag">{t("Интерактивное демо", "Interactive demo")}</span>
        </div>
        <div className="lab-tools">
          <label className="scenario-select">
            <span className="sr-only">{t("Сценарий демо", "Demo scenario")}</span>
            <select value={scenario} onChange={(e) => chooseScenario(e.target.value as Scenario)}>
              {scenarios.map((s) => (
                <option key={s} value={s}>
                  {scenarioNames[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="tool-button"
            onClick={() => setState((old) => ({ ...old, lang: old.lang === "ru" ? "en" : "ru" }))}
            aria-label={t("Switch to English", "Переключить на русский")}
          >
            <Icon name="globe" size={16} />
            {lang.toUpperCase()}
          </button>
          <button
            className="tool-button"
            aria-label={t(
              dark ? "Светлая тема" : "Тёмная тема",
              dark ? "Light theme" : "Dark theme",
            )}
            onClick={() => setState((old) => ({ ...old, dark: !old.dark }))}
          >
            <Icon name={dark ? "sun" : "moon"} size={17} />
          </button>
          <button
            className="tool-button"
            aria-label={t("Сбросить все демоданные", "Reset all demo data")}
            onClick={() => {
              setState((old) => ({
                ...freshState(),
                variant: old.variant,
                dark: old.dark,
                lang: old.lang,
              }));
              setDate(TODAY);
              navigate("today");
              setPrevious(null);
              setToast(t("Демонстрационные данные восстановлены", "Demo data restored"));
            }}
          >
            <Icon name="reset" size={17} />
          </button>
        </div>
      </header>
      <div className="concept-bar" aria-label={t("Варианты дизайна", "Design concepts")}>
        {(["a", "b", "c"] as Variant[]).map((id, index) => (
          <button
            key={id}
            className={`concept ${variant === id ? "selected" : ""}`}
            aria-pressed={variant === id}
            onClick={() => setState((old) => ({ ...old, variant: id }))}
          >
            <span className={`concept-letter swatch-${id}`}>{id.toUpperCase()}</span>
            <span>
              <strong>{names[id]}</strong>
              <small>
                {
                  [
                    t("Меньше шума. Больше своего.", "Less noise. More you."),
                    t("Каждый шаг на своём месте.", "Every step in its place."),
                    t("У каждого дня свой ритм.", "Every day has a rhythm."),
                  ][index]
                }
              </small>
            </span>
            {variant === id && (
              <span className="concept-check">
                <Icon name="check" size={15} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={`app-frame ${view === "website" ? "website-frame" : ""}`}>
        {view === "website" ? (
          <Landing
            variant={variant}
            lang={lang}
            t={t}
            onStart={() => navigate("today")}
            onNew={() => {
              chooseScenario("new");
              navigate("today");
            }}
          />
        ) : (
          <>
            <aside className="sidebar">
              <button
                className="brand"
                onClick={() => navigate("today")}
                aria-label={t("Ownday — сегодня", "Ownday — today")}
              >
                <span className="brand-mark">
                  <Icon name="leaf" size={22} />
                </span>
                ownday<span className="brand-dot">.</span>
              </button>
              <span className="sidebar-caption">
                {t("ПРОСТРАНСТВО ДЛЯ СЕБЯ", "A LITTLE SPACE FOR YOU")}
              </span>
              <nav className="side-nav" aria-label={t("Основная навигация", "Main navigation")}>
                {renderNav()}
              </nav>
              <div className="sidebar-bottom">
                <button className="site-link" onClick={() => navigate("website")}>
                  <Icon name="globe" size={18} />
                  {t("Сайт продукта", "Product website")}
                  <Icon name="arrow" size={16} />
                </button>
                <div className="local-note">
                  <span>
                    <Icon name="shield" size={18} />
                  </span>
                  <div>
                    <b>{t("Только твоё", "Only yours")}</b>
                    <small>{t("Демо хранится на устройстве", "Demo stays on this device")}</small>
                  </div>
                </div>
              </div>
            </aside>
            <div className="workspace">
              <div className="workspace-top">
                <span className="breadcrumb">
                  {t("Мой ритм", "My rhythm")}
                  <span>/</span>
                  {view === "detail"
                    ? t("О привычке", "Habit details")
                    : navItems.find((item) => item.id === view)?.label}
                </span>
                <span className="local-badge">
                  <i />
                  {t("Локальное демо", "Local demo")}
                </span>
              </div>
              {(scenario === "offline" ||
                (scenario === "error" && !retrySucceeded) ||
                storageError) && (
                <div
                  className={`status-banner ${scenario === "error" || storageError ? "warning" : ""}`}
                  role="status"
                >
                  <Icon name={scenario === "offline" ? "offline" : "cloud"} />
                  <span>
                    <b>
                      {storageError
                        ? t("Браузер не разрешает сохранение", "Browser storage is unavailable")
                        : scenario === "offline"
                          ? t("Без сети. Всё по-прежнему работает.", "Offline. Still your day.")
                          : t("Демо: не удалось синхронизировать", "Demo: sync could not complete")}
                    </b>
                    <small>
                      {storageError
                        ? t(
                            "Изменения доступны до закрытия страницы.",
                            "Changes will last until this page is closed.",
                          )
                        : t(
                            "Изменения сохраняются здесь. Облачные запросы не отправляются.",
                            "Changes stay here. No cloud requests are sent.",
                          )}
                    </small>
                  </span>
                  {scenario === "error" && !storageError && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setRetrySucceeded(true);
                        setToast(t("Демо: соединение восстановлено", "Demo: connection restored"));
                      }}
                    >
                      {t("Повторить", "Retry")}
                    </button>
                  )}
                </div>
              )}
              <main id="main-content" tabIndex={-1}>
                {view === "today" && (
                  <>
                    <header className="day-heading">
                      <div>
                        <p className="eyebrow">
                          {formatDate(date, lang, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                        <h1>
                          {variant === "a"
                            ? t(
                                "Хороший день начинается\nс малого.",
                                "A good day starts\nwith a little.",
                              )
                            : variant === "b"
                              ? t("Твой день. По делу.", "Your day. In focus.")
                              : t("Сегодня —\nв твоём ритме.", "Today,\nat your own pace.")}
                        </h1>
                        <p className="heading-description">
                          {variant === "b"
                            ? t("Намерение превращается в действие.", "Turn intention into action.")
                            : t(
                                "Не нужно успевать всё. Начни с того, что важно тебе.",
                                "You don’t have to do it all. Start with what matters to you.",
                              )}
                        </p>
                      </div>
                      {variant === "c" ? (
                        <Botanical t={t} />
                      ) : (
                        <div className="date-stamp">
                          <span>{formatDate(date, lang, { month: "short" })}</span>
                          <strong>{date.slice(-2)}</strong>
                          <small>{t("ТВОЙ ДЕНЬ", "YOUR DAY")}</small>
                        </div>
                      )}
                    </header>
                    <div className="dashboard-grid">
                      <div className="day-main">
                        <Week date={date} data={data} lang={lang} t={t} onDate={setDate} />
                        <div className="section-heading">
                          <div>
                            <h2>
                              {date === TODAY
                                ? t("На сегодня", "On your list")
                                : formatDate(date, lang, { day: "numeric", month: "long" })}
                              <span className="count-label">{visibleHabits.length}</span>
                            </h2>
                            <p>
                              {stat.due > 0 && stat.done === stat.due
                                ? t(
                                    "Всё на сегодня. Побудь в этом моменте.",
                                    "All done. Take a moment for yourself.",
                                  )
                                : t(
                                    "Маленькие действия складываются в большие перемены.",
                                    "Small actions make room for bigger changes.",
                                  )}
                            </p>
                          </div>
                          <button
                            className="small-add"
                            aria-label={t("Добавить привычку", "Add a habit")}
                            onClick={() => openCreate()}
                          >
                            <Icon name="plus" size={18} />
                          </button>
                        </div>
                        {data.habits.length === 0 ? (
                          <Empty t={t} onCreate={openCreate} />
                        ) : visibleHabits.length === 0 ? (
                          <div className="empty-state">
                            <Icon name="moon" size={34} />
                            <h3>{t("День без планов", "Nothing scheduled")}</h3>
                            <p>
                              {t(
                                "На эту дату нет привычек. Можно отдохнуть.",
                                "No habits scheduled for this date. Take a breather.",
                              )}
                            </p>
                            <button className="text-button" onClick={() => setDate(TODAY)}>
                              {t("Вернуться к сегодня", "Back to today")}
                            </button>
                          </div>
                        ) : variant === "c" ? (
                          <div className="ritual-groups">
                            {(["morning", "afternoon", "evening"] as const).map((time) => {
                              const items = visibleHabits.filter((h) => h.time === time);
                              return (
                                items.length > 0 && (
                                  <section key={time} className={`ritual-group ${time}`}>
                                    <h3>
                                      <Icon
                                        name={
                                          time === "evening"
                                            ? "moon"
                                            : time === "morning"
                                              ? "sun"
                                              : "leaf"
                                        }
                                        size={17}
                                      />
                                      {timeLabel(time, t)}
                                      <span>
                                        {
                                          items.filter(
                                            (h) => entryFor(data, h, date)?.status === "done",
                                          ).length
                                        }
                                        /{items.length}
                                      </span>
                                    </h3>
                                    <div className="ritual-cards">{items.map(row)}</div>
                                  </section>
                                )
                              );
                            })}
                          </div>
                        ) : (
                          <div className="habit-list">
                            {variant === "b" && (
                              <div className="table-head">
                                <span>{t("ПРИВЫЧКА", "HABIT")}</span>
                                <span>{t("ПРОГРЕСС / ДЕЙСТВИЕ", "PROGRESS / ACTION")}</span>
                              </div>
                            )}
                            {visibleHabits.map(row)}
                          </div>
                        )}
                        {data.habits.length > 0 && (
                          <button className="add-habit-line" onClick={() => openCreate()}>
                            <Icon name="plus" size={18} />
                            {t("Добавить привычку", "Add a habit")}
                            <span>{t("Ещё один маленький шаг", "One more little step")}</span>
                          </button>
                        )}
                        <p className="day-footnote">
                          <Icon name="leaf" size={15} />
                          {t(
                            "Пауза — тоже часть пути. Пропуск не прерывает серию.",
                            "Rest belongs here, too. Skipping a day keeps your streak.",
                          )}
                        </p>
                      </div>
                      <aside className="insights">
                        <section className="progress-card">
                          <p className="eyebrow">
                            {t("ТВОЙ СЕГОДНЯШНИЙ РИТМ", "YOUR DAILY RHYTHM")}
                          </p>
                          <Ring percent={stat.percent}>
                            <strong>
                              {stat.done}
                              <span>/{stat.due}</span>
                            </strong>
                            <small>{t("выполнено", "completed")}</small>
                          </Ring>
                          <p>
                            {stat.done === stat.due && stat.due > 0
                              ? t("Ты сделал достаточно.", "You’ve done enough.")
                              : t("Каждый шаг имеет значение.", "Every little step counts.")}
                          </p>
                          <div className="card-divider" />
                          <div className="mini-metrics">
                            <div>
                              <strong>
                                {progress.percent}
                                <small>%</small>
                              </strong>
                              <span>{t("за неделю", "this week")}</span>
                            </div>
                            <div>
                              <strong>{progress.perfect}</strong>
                              <span>{t("полных дней", "complete days")}</span>
                            </div>
                          </div>
                        </section>
                        <section className="weekly-card">
                          <div className="section-inline">
                            <h3>{t("Неделя в движении", "Your week, unfolding")}</h3>
                            <Icon name="chart" size={17} />
                          </div>
                          <MiniBars data={data} end={TODAY} lang={lang} />
                          <button className="text-button" onClick={() => navigate("progress")}>
                            {t("Посмотреть прогресс", "Explore your progress")}
                            <Icon name="arrow" size={16} />
                          </button>
                        </section>
                        <section className="quote-card">
                          <span className="quote-mark">“</span>
                          <p>
                            {variant === "b"
                              ? t(
                                  "Стабильность важнее\nидеального результата.",
                                  "Consistency over\nperfection.",
                                )
                              : t(
                                  "Ты не начинаешь заново.\nТы продолжаешь.",
                                  "You’re not starting over.\nYou’re continuing.",
                                )}
                          </p>
                          <span className="eyebrow">
                            {t("НАПОМИНАНИЕ СЕБЕ", "A NOTE TO YOURSELF")}
                          </span>
                          <Icon name="leaf" size={35} />
                        </section>
                      </aside>
                    </div>
                  </>
                )}
                {view === "habits" && (
                  <>
                    <PageHeading
                      eyebrow={t("ТО, ЧТО ВАЖНО", "WHAT MATTERS")}
                      title={t("Твои привычки", "Your habits")}
                      description={t(
                        "Не список обязанностей. Твои маленькие обещания себе.",
                        "Not a list of obligations. Little promises to yourself.",
                      )}
                      action={
                        <button className="primary-button" onClick={() => openCreate()}>
                          <Icon name="plus" size={18} />
                          {t("Новая привычка", "New habit")}
                        </button>
                      }
                    />
                    <div className="habit-gallery">
                      {data.habits.map((habit) => (
                        <button
                          className="habit-tile"
                          key={habit.id}
                          onClick={() => openHabit(habit)}
                        >
                          <span className={`habit-icon icon-${habit.icon}`}>
                            <Icon name={habit.icon} size={24} />
                          </span>
                          <span className="tile-time">{timeLabel(habit.time, t)}</span>
                          <h2>{titleFor(habit, lang)}</h2>
                          <p>
                            {scheduleLabel(habit, t)} ·{" "}
                            {habit.type === "binary"
                              ? t("Одна отметка", "One check-in")
                              : `${habit.target} ${habit.unit[lang]}`}
                          </p>
                          <div className="tile-bottom">
                            <span>
                              {habitRate(data, habit, TODAY, 7).percent}%{" "}
                              <small>{t("за неделю", "this week")}</small>
                            </span>
                            <Icon name="arrow" size={19} />
                          </div>
                        </button>
                      ))}
                      <button className="habit-tile new-tile" onClick={() => openCreate()}>
                        <Icon name="plus" size={28} />
                        <h2>{t("Место для нового", "Room for something new")}</h2>
                        <p>
                          {t("Начни с одного простого действия", "Start with one simple action")}
                        </p>
                      </button>
                    </div>
                    <TemplateList t={t} onSelect={openCreate} />
                  </>
                )}
                {view === "progress" && (
                  <>
                    <PageHeading
                      eyebrow={t("ПОСМОТРИ, КАК ДАЛЕКО ТЫ ПРОШЁЛ", "LOOK HOW FAR YOU’VE COME")}
                      title={t("Прогресс, а не идеал", "Progress, not perfection")}
                      description={t(
                        "Здесь видны усилия. Даже те, которые кажутся маленькими.",
                        "Your effort shows here. Even the little things.",
                      )}
                      action={<Period period={period} setPeriod={setPeriod} t={t} />}
                    />
                    <Progress data={data} lang={lang} t={t} period={period} onOpen={openHabit} />
                  </>
                )}
                {view === "detail" && currentHabit && (
                  <>
                    <button className="back-link" onClick={() => navigate("habits")}>
                      <Icon name="back" size={17} />
                      {t("Все привычки", "All habits")}
                    </button>
                    <PageHeading
                      eyebrow={scheduleLabel(currentHabit, t)}
                      title={titleFor(currentHabit, lang)}
                      description={`${t("Твоя цель", "Your goal")}: ${currentHabit.target} ${currentHabit.unit[lang]} · ${timeLabel(currentHabit.time, t)}`}
                      action={
                        <span className={`habit-icon large-icon icon-${currentHabit.icon}`}>
                          <Icon name={currentHabit.icon} size={32} />
                        </span>
                      }
                    />
                    <div className="detail-grid">
                      <section className="detail-calendar surface">
                        <div className="section-inline">
                          <h2>{t("История привычки", "Habit history")}</h2>
                          <span>{formatDate(date, lang, { month: "long", year: "numeric" })}</span>
                        </div>
                        <Calendar
                          data={data}
                          habit={currentHabit}
                          date={date}
                          setDate={setDate}
                          lang={lang}
                          t={t}
                        />
                        <p className="calendar-hint">
                          {t(
                            "Выбери день, чтобы посмотреть или изменить отметку.",
                            "Choose a day to view or change a check-in.",
                          )}
                        </p>
                        <HabitRow
                          habit={currentHabit}
                          data={data}
                          date={date}
                          lang={lang}
                          t={t}
                          onMark={mark}
                          onOpen={() => undefined}
                          detail
                        />
                        <div className="calendar-legend">
                          <span>
                            <i className="legend-done" />
                            {t("Выполнено", "Done")}
                          </span>
                          <span>
                            <i className="legend-partial" />
                            {t("В процессе", "In progress")}
                          </span>
                          <span>Ⅱ {t("Пропуск", "Skipped")}</span>
                        </div>
                      </section>
                      <aside className="detail-aside">
                        <section className="surface detail-stat">
                          <Icon name="flame" size={28} />
                          <strong>{streak(data, currentHabit, TODAY)}</strong>
                          <span>
                            {currentHabit.schedule === "weekly"
                              ? t("недель в серии", "week streak")
                              : t("дней в серии", "day streak")}
                          </span>
                        </section>
                        <section className="surface detail-stat">
                          <strong>{habitRate(data, currentHabit, TODAY, 30).percent}%</strong>
                          <span>{t("выполнение за 30 дней", "completion over 30 days")}</span>
                          <Spark data={data} habit={currentHabit} end={TODAY} count={30} />
                        </section>
                      </aside>
                    </div>
                  </>
                )}
              </main>
              <footer className="app-footer">
                <span>ownday — {t("в своём ритме", "at your own pace")}</span>
                <span>
                  {t(
                    "Демонстрационные данные · 13 сентября 2026",
                    "Sample data · 13 September 2026",
                  )}
                </span>
              </footer>
            </div>
            <nav className="mobile-nav" aria-label={t("Мобильная навигация", "Mobile navigation")}>
              {renderNav()}
              <button className="nav-item" onClick={() => navigate("website")}>
                <Icon name="globe" />
                <span>{t("Сайт", "Website")}</span>
              </button>
            </nav>
          </>
        )}
      </div>
      <div className="lab-footer">
        <span>
          {variant.toUpperCase()} / {names[variant]}
        </span>
        <span>
          {t("Три взгляда на один день. Выбирай свой.", "Three ways to see your day. Find yours.")}
        </span>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{toast}</span>
          {previous && previous.scenario === scenario && (
            <button
              onClick={() => {
                updateData(previous.data);
                setPrevious(null);
                setToast(t("Действие отменено", "Action undone"));
              }}
            >
              {t("Отменить", "Undo")}
            </button>
          )}
          <button
            aria-label={t("Закрыть уведомление", "Dismiss notification")}
            onClick={() => setToast("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {createOpen && (
        <CreateDialog
          lang={lang}
          t={t}
          initial={template}
          onClose={() => setCreateOpen(false)}
          onSave={addHabit}
        />
      )}
    </div>
  );
}

function timeLabel(time: Habit["time"], t: Translate) {
  return time === "morning"
    ? t("Утро", "Morning")
    : time === "afternoon"
      ? t("День", "Afternoon")
      : t("Вечер", "Evening");
}
function scheduleLabel(habit: Habit, t: Translate) {
  return habit.schedule === "daily"
    ? t("Каждый день", "Every day")
    : habit.schedule === "weekdays"
      ? t("По будням", "Weekdays")
      : t(`${habit.weeklyTarget} раза в неделю`, `${habit.weeklyTarget} times a week`);
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="heading-description">{description}</p>
      </div>
      {action}
    </header>
  );
}
function HabitRow({
  habit,
  data,
  date,
  lang,
  t,
  onMark,
  onOpen,
  detail = false,
}: {
  habit: Habit;
  data: DemoData;
  date: string;
  lang: Lang;
  t: Translate;
  onMark: (habit: Habit, action: "toggle" | "skip" | number) => void;
  onOpen: (habit: Habit) => void;
  detail?: boolean;
}) {
  const entry = entryFor(data, habit, date);
  const done = entry?.status === "done",
    skipped = entry?.status === "skip";
  const count = streak(data, habit, TODAY);
  const value = entry?.value ?? 0;
  const inactive = date > TODAY || !isDue(habit, date);
  const name = titleFor(habit, lang);
  return (
    <article className={`habit-row ${done ? "is-done" : ""} ${skipped ? "is-skipped" : ""}`}>
      <span className={`habit-icon icon-${habit.icon}`}>
        <Icon name={habit.icon} size={21} />
      </span>
      <div className="habit-body">
        {detail ? (
          <h3>{formatDate(date, lang, { day: "numeric", month: "long" })}</h3>
        ) : (
          <button className="habit-name" onClick={() => onOpen(habit)}>
            {name}
          </button>
        )}
        <div className="habit-meta">
          <span>
            {inactive
              ? t("Не запланировано", "Not scheduled")
              : skipped
                ? t("Пауза на сегодня", "Taking a pause")
                : habit.type === "binary"
                  ? scheduleLabel(habit, t)
                  : `${value} / ${habit.target} ${habit.unit[lang]}`}
          </span>
          {count > 0 && (
            <span
              className={`streak ${count >= 7 ? "hot" : ""}`}
              title={t("Текущая серия", "Current streak")}
            >
              <Icon name="flame" size={12} />
              {count}
              {habit.schedule === "weekly" ? t(" нед.", " wk") : ""}
            </span>
          )}
        </div>
        {habit.type !== "binary" && (
          <div
            className="habit-progress"
            role="progressbar"
            aria-label={`${name}: ${t("прогресс", "progress")}`}
            aria-valuenow={Math.min(value, habit.target)}
            aria-valuemin={0}
            aria-valuemax={habit.target}
          >
            <span style={{ width: `${Math.min(100, (value / habit.target) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="habit-actions">
        {habit.type !== "binary" && !skipped && (
          <div className="stepper">
            <button
              disabled={inactive || value === 0}
              aria-label={`${t("Уменьшить", "Decrease")}: ${name}`}
              onClick={() => onMark(habit, habit.type === "duration" ? -5 : -1)}
            >
              <Icon name="minus" size={14} />
            </button>
            <span>{value}</span>
            <button
              disabled={inactive}
              aria-label={`${t("Увеличить", "Increase")}: ${name}`}
              onClick={() => onMark(habit, habit.type === "duration" ? 5 : 1)}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        )}
        <button
          disabled={inactive}
          className={`check-button ${done ? "checked" : ""}`}
          aria-label={`${done ? t("Отменить выполнение", "Undo completion") : t("Выполнить", "Complete")}: ${name}`}
          aria-pressed={done}
          onClick={() => onMark(habit, "toggle")}
        >
          <Icon name="check" size={18} />
        </button>
        <button
          disabled={inactive}
          className={`skip-button ${skipped ? "skipped" : ""}`}
          title={
            skipped ? t("Отменить пропуск", "Undo skip") : t("Пропустить день", "Skip this day")
          }
          aria-label={`${skipped ? t("Отменить пропуск", "Undo skip") : t("Пропустить", "Skip")}: ${name}`}
          aria-pressed={skipped}
          onClick={() => onMark(habit, "skip")}
        >
          <Icon name="skip" size={14} />
        </button>
      </div>
    </article>
  );
}
function Week({
  date,
  data,
  lang,
  t,
  onDate,
}: {
  date: string;
  data: DemoData;
  lang: Lang;
  t: Translate;
  onDate: (date: string) => void;
}) {
  const start = monday(date);
  return (
    <section className="week-section" aria-label={t("Календарь недели", "Week calendar")}>
      <div className="week-heading">
        <span>
          {formatDate(start, lang, { day: "numeric", month: "short" })} —{" "}
          {formatDate(shiftDate(start, 6), lang, { day: "numeric", month: "short" })}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label={t("Предыдущая неделя", "Previous week")}
            onClick={() => onDate(shiftDate(date, -7))}
          >
            <Icon name="back" size={15} />
          </button>
          <button className="text-button today-link" onClick={() => onDate(TODAY)}>
            {t("Сегодня", "Today")}
          </button>
          <button
            className="icon-button"
            disabled={shiftDate(start, 7) > TODAY}
            aria-label={t("Следующая неделя", "Next week")}
            onClick={() => onDate(shiftDate(date, 7) > TODAY ? TODAY : shiftDate(date, 7))}
          >
            <Icon name="arrow" size={15} />
          </button>
        </div>
      </div>
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const d = shiftDate(start, i),
            stats = dayStats(data, d);
          return (
            <button
              key={d}
              disabled={d > TODAY}
              className={`week-day ${date === d ? "selected" : ""}`}
              aria-pressed={date === d}
              aria-label={`${formatDate(d, lang, { weekday: "long", day: "numeric", month: "long" })}: ${stats.percent}%`}
              onClick={() => onDate(d)}
            >
              <span>{formatDate(d, lang, { weekday: "short" })}</span>
              <strong>{Number(d.slice(-2))}</strong>
              <span className="day-dot">
                {stats.due > 0 && stats.done === stats.due ? (
                  <Icon name="check" size={12} />
                ) : (
                  <i style={{ opacity: stats.percent > 0 ? 1 : 0.25 }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
function Ring({ percent, children }: { percent: number; children: ReactNode }) {
  return (
    <div className="ring">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="68" className="ring-track" />
        <circle
          cx="80"
          cy="80"
          r="68"
          className="ring-value"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <div>{children}</div>
    </div>
  );
}
function MiniBars({ data, end, lang }: { data: DemoData; end: string; lang: Lang }) {
  return (
    <div className="mini-bars">
      {dates(end, 7).map((date) => (
        <div
          key={date}
          title={`${formatDate(date, lang, { day: "numeric", month: "short" })}: ${dayStats(data, date).percent}%`}
        >
          <div className="mini-bar-track">
            <i style={{ height: `${dayStats(data, date).percent}%` }} />
          </div>
          <span>{formatDate(date, lang, { weekday: "short" }).slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );
}
function Spark({
  data,
  habit,
  end,
  count,
}: {
  data: DemoData;
  habit?: Habit;
  end: string;
  count: number;
}) {
  const values = dates(end, count).map((date) =>
    habit
      ? entryFor(data, habit, date)?.status === "done"
        ? 100
        : 0
      : dayStats(data, date).percent,
  );
  const points = values
    .map((value, index) => `${(index / (count - 1)) * 300},${85 - value * 0.7}`)
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 85H300M0 50H300M0 15H300" className="chart-grid" />
      <polygon points={`0,100 ${points} 300,100`} className="chart-area" />
      <polyline points={points} className="chart-line" />
    </svg>
  );
}
function Period({
  period,
  setPeriod,
  t,
}: {
  period: 7 | 30;
  setPeriod: (p: 7 | 30) => void;
  t: Translate;
}) {
  return (
    <div className="period-switch" aria-label={t("Период статистики", "Statistics period")}>
      {([7, 30] as const).map((p) => (
        <button
          key={p}
          aria-pressed={period === p}
          className={period === p ? "active" : ""}
          onClick={() => setPeriod(p)}
        >
          {p === 7 ? t("Неделя", "Week") : t("Месяц", "Month")}
        </button>
      ))}
    </div>
  );
}
function Progress({
  data,
  lang,
  t,
  period,
  onOpen,
}: {
  data: DemoData;
  lang: Lang;
  t: Translate;
  period: number;
  onOpen: (h: Habit) => void;
}) {
  const result = summary(data, TODAY, period);
  return (
    <>
      <div className="stat-cards">
        <section className="surface stat-card">
          <span>{t("Выполнение", "Completion")}</span>
          <strong>
            {result.percent}
            <small>%</small>
          </strong>
          <span>{t("От запланированного", "Of your planned habits")}</span>
        </section>
        <section className="surface stat-card">
          <span>{t("Маленьких побед", "Little wins")}</span>
          <strong>{result.done}</strong>
          <span>{t(`За ${period} дней`, `Over ${period} days`)}</span>
        </section>
        <section className="surface stat-card">
          <span>{t("Полных дней", "Complete days")}</span>
          <strong>{result.perfect}</strong>
          <span>{t("Всё запланированное выполнено", "Every scheduled habit completed")}</span>
        </section>
      </div>
      <section className="surface trend-card">
        <div className="section-inline">
          <h2>{t("Твой ритм в движении", "Your rhythm over time")}</h2>
          <span>
            {formatDate(shiftDate(TODAY, 1 - period), lang, { day: "numeric", month: "short" })} —{" "}
            {formatDate(TODAY, lang, { day: "numeric", month: "short" })}
          </span>
        </div>
        <div className="trend-chart">
          <div className="chart-labels">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <Spark data={data} end={TODAY} count={period} />
        </div>
        <div className="chart-dates">
          <span>
            {formatDate(shiftDate(TODAY, 1 - period), lang, { day: "numeric", month: "short" })}
          </span>
          <span>{t("Сегодня", "Today")}</span>
        </div>
        <p className="chart-explanation">
          {t(
            "Каждая точка — доля выполненных привычек дня. Пропуски исключены.",
            "Each point shows daily habit completion. Skipped habits are excluded.",
          )}
        </p>
        <details className="chart-data">
          <summary>{t("Посмотреть значения графика", "View chart values")}</summary>
          <div className="data-values">
            {dates(TODAY, period).map((d) => (
              <span key={d}>
                {formatDate(d, lang, { day: "numeric", month: "short" })}:{" "}
                <b>{dayStats(data, d).percent}%</b>
              </span>
            ))}
          </div>
        </details>
      </section>
      <div className="section-heading">
        <h2>{t("У каждой привычки свой путь", "Every habit has a story")}</h2>
      </div>
      <div className="habit-stat-list">
        {data.habits.length ? (
          data.habits.map((habit) => {
            const rate = habitRate(data, habit, TODAY, period);
            return (
              <button className="habit-stat-row" key={habit.id} onClick={() => onOpen(habit)}>
                <span className={`habit-icon icon-${habit.icon}`}>
                  <Icon name={habit.icon} />
                </span>
                <span className="stat-habit-title">
                  <b>{titleFor(habit, lang)}</b>
                  <small>
                    {scheduleLabel(habit, t)} · {rate.done}/{rate.due}
                  </small>
                </span>
                <Spark data={data} habit={habit} end={TODAY} count={period} />
                <strong>{rate.percent}%</strong>
                <Icon name="chevron" size={17} />
              </button>
            );
          })
        ) : (
          <p className="surface empty-caption">
            {t(
              "Первая отметка станет началом твоей истории.",
              "Your first check-in starts your story.",
            )}
          </p>
        )}
      </div>
    </>
  );
}
function Calendar({
  data,
  habit,
  date,
  setDate,
  lang,
  t,
}: {
  data: DemoData;
  habit: Habit;
  date: string;
  setDate: (d: string) => void;
  lang: Lang;
  t: Translate;
}) {
  const first = `${date.slice(0, 7)}-01`,
    start = monday(first);
  return (
    <>
      <div className="calendar-controls">
        <button
          className="icon-button"
          aria-label={t("Предыдущий месяц", "Previous month")}
          onClick={() => setDate(shiftDate(first, -1))}
        >
          <Icon name="back" size={18} />
        </button>
        <button className="text-button" onClick={() => setDate(TODAY)}>
          {t("К сегодняшнему дню", "Back to today")}
        </button>
        <button
          className="icon-button"
          disabled={date.slice(0, 7) >= TODAY.slice(0, 7)}
          aria-label={t("Следующий месяц", "Next month")}
          onClick={() => {
            const next = shiftDate(first, 32).slice(0, 7) + "-01";
            setDate(next);
          }}
        >
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {Array.from({ length: 7 }, (_, i) => (
          <span className="calendar-weekday" key={i}>
            {formatDate(shiftDate(start, i), lang, { weekday: "short" })}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const d = shiftDate(start, i),
            entry = entryFor(data, habit, d),
            currentMonth = d.slice(0, 7) === date.slice(0, 7);
          const statusLabel =
            entry?.status === "done"
              ? t("выполнено", "done")
              : entry?.status === "skip"
                ? t("пропуск", "skipped")
                : entry?.status === "partial"
                  ? t("в процессе", "in progress")
                  : t("нет отметки", "no check-in");
          return (
            <button
              key={d}
              className={`calendar-day ${currentMonth ? "" : "outside"} ${entry?.status ?? ""} ${d === date ? "selected" : ""}`}
              aria-pressed={d === date}
              aria-label={`${formatDate(d, lang, { day: "numeric", month: "long" })}: ${statusLabel}`}
              disabled={d > TODAY || !isDue(habit, d)}
              onClick={() => setDate(d)}
            >
              <span>{Number(d.slice(-2))}</span>
              <small>
                {entry?.status === "done"
                  ? "✓"
                  : entry?.status === "skip"
                    ? "Ⅱ"
                    : entry?.status === "partial"
                      ? "·"
                      : ""}
              </small>
            </button>
          );
        })}
      </div>
    </>
  );
}
function Empty({ t, onCreate }: { t: Translate; onCreate: (initial?: Partial<Habit>) => void }) {
  return (
    <section className="empty-state">
      <div className="empty-flower">
        <Icon name="leaf" size={45} />
      </div>
      <p className="eyebrow">{t("НАЧНИ С МАЛОГО", "START SMALL")}</p>
      <h2>{t("Всё начинается\nс одной привычки.", "It all starts\nwith one little habit.")}</h2>
      <p>
        {t(
          "Стакан воды. Пять минут тишины.\nВыбери то, что сделает твой день чуть лучше.",
          "A glass of water. Five quiet minutes.\nChoose something that makes your day a little better.",
        )}
      </p>
      <button className="primary-button" onClick={() => onCreate()}>
        <Icon name="plus" size={18} />
        {t("Создать первую привычку", "Create your first habit")}
      </button>
      <TemplateList t={t} onSelect={onCreate} />
    </section>
  );
}
function TemplateList({ t, onSelect }: { t: Translate; onSelect: (h: Partial<Habit>) => void }) {
  return (
    <section className="templates">
      <p className="eyebrow">{t("ИЛИ НАЧНИ С ИДЕИ", "OR START WITH AN IDEA")}</p>
      <div>
        {seedData()
          .habits.slice(0, 3)
          .map((h) => (
            <button key={h.id} className="template-chip" onClick={() => onSelect(h)}>
              <Icon name={h.icon} size={17} />
              {h.id === "water"
                ? t("Стакан воды", "A glass of water")
                : h.id === "read"
                  ? t("Немного чтения", "A little reading")
                  : t("Прогулка", "A walk")}
              <Icon name="plus" size={15} />
            </button>
          ))}
      </div>
    </section>
  );
}
function CreateDialog({
  lang,
  t,
  initial,
  onClose,
  onSave,
}: {
  lang: Lang;
  t: Translate;
  initial: Partial<Habit> | undefined;
  onClose: () => void;
  onSave: (habit: Habit) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<Habit["type"]>(initial?.type ?? "binary");
  const [schedule, setSchedule] = useState<Habit["schedule"]>(initial?.schedule ?? "daily");
  const [icon, setIcon] = useState(initial?.icon ?? "leaf");
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    if (title.length < 2) {
      const input = form.elements.namedItem("title") as HTMLInputElement;
      input.setCustomValidity(t("Введите хотя бы два символа", "Enter at least two characters"));
      input.reportValidity();
      return;
    }
    const target = type === "binary" ? 1 : Number(fields.get("target"));
    const unit =
      type === "duration"
        ? { ru: "мин", en: "min" }
        : type === "binary"
          ? { ru: "раз", en: "time" }
          : initial?.unit && initial.unit[lang] === fields.get("unit")
            ? initial.unit
            : {
                ru: String(fields.get("unit") || "раз"),
                en: String(fields.get("unit") || "times"),
              };
    const unchangedTemplate = initial?.title && initial.title[lang] === title;
    onSave({
      id: crypto.randomUUID(),
      title: unchangedTemplate ? initial.title! : { ru: title, en: title },
      icon,
      type,
      target,
      unit,
      time: String(fields.get("time")) as Habit["time"],
      schedule,
      weeklyTarget: Number(fields.get("weeklyTarget") ?? 3),
      startedOn: TODAY,
    });
  };
  return (
    <dialog ref={ref} className="create-dialog" onCancel={onClose} aria-labelledby="create-title">
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">{t("ОДИН МАЛЕНЬКИЙ ШАГ", "ONE LITTLE STEP")}</p>
          <h2 id="create-title">{t("Новая привычка", "A new habit")}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t("Закрыть", "Close")}>
          <Icon name="close" />
        </button>
      </div>
      <form onSubmit={submit}>
        <label className="field">
          <span>{t("Что хочешь делать?", "What would you like to do?")}</span>
          <input
            name="title"
            required
            minLength={2}
            maxLength={100}
            autoFocus
            placeholder={t("Например, читать перед сном", "For example, read before bed")}
            defaultValue={initial?.title?.[lang] ?? ""}
            onInput={(e) => e.currentTarget.setCustomValidity("")}
          />
        </label>
        <fieldset className="type-fieldset">
          <legend>{t("Как будем отмечать?", "How will you track it?")}</legend>
          <div className="type-options">
            {(["binary", "counter", "duration"] as const).map((value) => (
              <label key={value} className={type === value ? "selected" : ""}>
                <input
                  type="radio"
                  name="habitType"
                  checked={type === value}
                  onChange={() => setType(value)}
                />
                <Icon
                  name={value === "binary" ? "check" : value === "counter" ? "plus" : "clock"}
                />
                <span>
                  {value === "binary"
                    ? t("Да / нет", "Check-in")
                    : value === "counter"
                      ? t("Количество", "Count")
                      : t("Время", "Duration")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {type !== "binary" && (
          <div className="form-columns">
            <label className="field">
              <span>{t("Цель на день", "Daily goal")}</span>
              <input
                key={type}
                name="target"
                type="number"
                min="1"
                max="10000"
                step="1"
                required
                defaultValue={
                  initial?.type === type ? initial.target : type === "duration" ? 15 : 8
                }
              />
            </label>
            {type === "counter" ? (
              <label className="field">
                <span>{t("Единица измерения", "Unit")}</span>
                <input
                  name="unit"
                  maxLength={20}
                  defaultValue={initial?.unit?.[lang] ?? t("раз", "times")}
                  required
                />
              </label>
            ) : (
              <div className="unit-explanation">{t("минут в день", "minutes a day")}</div>
            )}
          </div>
        )}
        <div className="form-columns">
          <label className="field">
            <span>{t("Повторять", "Repeat")}</span>
            <select
              name="schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as Habit["schedule"])}
            >
              <option value="daily">{t("Каждый день", "Every day")}</option>
              <option value="weekdays">{t("По будням", "Weekdays")}</option>
              <option value="weekly">{t("Несколько раз в неделю", "Times per week")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("Когда удобнее", "Your time of day")}</span>
            <select name="time" defaultValue={initial?.time ?? "morning"}>
              {(["morning", "afternoon", "evening"] as const).map((time) => (
                <option key={time} value={time}>
                  {timeLabel(time, t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {schedule === "weekly" && (
          <label className="field">
            <span>{t("Раз в неделю", "Times per week")}</span>
            <input name="weeklyTarget" type="number" min="1" max="7" required defaultValue={3} />
          </label>
        )}
        <details className="extra-options">
          <summary>{t("Выбрать значок", "Choose an icon")}</summary>
          <div className="icon-options">
            {["leaf", "water", "book", "walk", "sun", "pen", "moon"].map((name, i) => (
              <button
                key={name}
                type="button"
                aria-pressed={icon === name}
                aria-label={
                  [
                    t("Лист", "Leaf"),
                    t("Вода", "Water"),
                    t("Книга", "Book"),
                    t("Прогулка", "Walk"),
                    t("Солнце", "Sun"),
                    t("Записи", "Writing"),
                    t("Луна", "Moon"),
                  ][i]
                }
                className={icon === name ? "selected" : ""}
                onClick={() => setIcon(name)}
              >
                <Icon name={name} />
              </button>
            ))}
          </div>
        </details>
        <p className="form-note">
          <Icon name="shield" size={15} />
          {t(
            "Без регистрации. Сохранится только в этом демо.",
            "No account needed. Saved only in this demo.",
          )}
        </p>
        <button className="primary-button submit-button" type="submit">
          {t("Добавить в мой день", "Add to my day")}
          <Icon name="arrow" size={19} />
        </button>
      </form>
    </dialog>
  );
}
function Botanical({ t }: { t: Translate }) {
  return (
    <div className="botanical" aria-hidden="true">
      <span className="botanical-sun" />
      <svg viewBox="0 0 180 170" fill="none">
        <path d="M86 155c-9-41 4-83 32-115M92 117C45 123 21 98 27 64c37 0 62 21 65 53Z" />
        <path d="M98 90c0-40 27-58 62-54 1 33-23 56-62 54ZM81 153c-2-35-22-52-53-48 1 30 19 47 53 48Z" />
        <path d="m90 116-43-31m56 2 39-34M83 150l-40-33" />
      </svg>
      <span className="botanical-caption">
        {t("понемногу, каждый день.", "a little, every day.")}
      </span>
    </div>
  );
}
function Landing({
  variant,
  lang,
  t,
  onStart,
  onNew,
}: {
  variant: Variant;
  lang: Lang;
  t: Translate;
  onStart: () => void;
  onNew: () => void;
}) {
  const sample = seedData();
  return (
    <main id="main-content" className="landing" tabIndex={-1}>
      <nav className="landing-nav" aria-label={t("Навигация сайта", "Website navigation")}>
        <button className="brand" onClick={onStart}>
          <span className="brand-mark">
            <Icon name="leaf" size={22} />
          </span>
          ownday<span className="brand-dot">.</span>
        </button>
        <div>
          <a href="#how-it-works">{t("Как это работает", "How it works")}</a>
          <a href="#faq">FAQ</a>
          <button className="outline-button" onClick={onStart}>
            {t("Открыть демо", "Open demo")}
            <Icon name="arrow" size={17} />
          </button>
        </div>
      </nav>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">
            <span className="tiny-dot" />
            {t("МАЛЕНЬКИЕ ПРИВЫЧКИ. БОЛЬШЕ ТЕБЯ.", "SMALL HABITS. MORE YOU.")}
          </p>
          <h1>
            {variant === "a"
              ? t("Хорошие дни\nрастут из\nмаленьких дел.", "Good days\ngrow from\nlittle things.")
              : variant === "b"
                ? t(
                    "Твои привычки.\nТвой прогресс.\nТвой день.",
                    "Your habits.\nYour progress.\nYour day.",
                  )
                : t("Сделай место\nдля себя.", "Make room\nfor yourself.")}
          </h1>
          <p>
            {t(
              "Ownday помогает находить свой ритм — без давления, бесконечных списков и гонки за идеалом.",
              "Ownday helps you find your rhythm. Without pressure, endless lists, or chasing perfection.",
            )}
          </p>
          <button className="primary-button" onClick={onNew}>
            {t("Попробовать без регистрации", "Try without an account")}
            <Icon name="arrow" size={19} />
          </button>
          <span className="landing-note">
            {t(
              "Интерактивное демо · ничего устанавливать не нужно",
              "Interactive demo · no installation needed",
            )}
          </span>
          <div className="landing-benefits">
            <span>
              <Icon name="shield" size={17} />
              {t("Твои данные — твои", "Your data is yours")}
            </span>
            <span>
              <Icon name="offline" size={17} />
              {t("В своём темпе", "At your own pace")}
            </span>
          </div>
        </div>
        <div className="landing-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-note">
            <Icon name="leaf" size={18} />
            {t("Один шаг уже считается.", "One little step counts.")}
          </div>
          <div className="phone-preview">
            <div className="phone-top">
              <span>9:41</span>
              <span>••• ▰</span>
            </div>
            <p className="eyebrow">{t("ВОСКРЕСЕНЬЕ, 13 СЕНТЯБРЯ", "SUNDAY, 13 SEPTEMBER")}</p>
            <h2>{t("Привет, новый день.", "Hello, new day.")}</h2>
            <p>{t("Сегодня — в твоём ритме.", "Today, at your own pace.")}</p>
            <div className="phone-week">
              {dates(TODAY, 7).map((d) => (
                <span className={d === TODAY ? "selected" : ""} key={d}>
                  {Number(d.slice(-2))}
                </span>
              ))}
            </div>
            {sample.habits.slice(0, 4).map((h) => (
              <div className="phone-row" key={h.id}>
                <span className={`habit-icon icon-${h.icon}`}>
                  <Icon name={h.icon} size={17} />
                </span>
                <div>
                  <b>{titleFor(h, lang)}</b>
                  <small>{scheduleLabel(h, t)}</small>
                </div>
                <span
                  className={
                    entryFor(sample, h, TODAY)?.status === "done"
                      ? "phone-check done"
                      : "phone-check"
                  }
                >
                  <Icon name="check" size={13} />
                </span>
              </div>
            ))}
            <button className="phone-add" onClick={onStart}>
              <Icon name="plus" size={15} />
              {t("Мой день", "My day")}
            </button>
            <p className="phone-bottom">
              {t("Не идеально. Зато по-настоящему.", "Not perfect. Just real.")}
            </p>
          </div>
          <div className="floating-streak">
            <Icon name="sun" size={25} />
            <span>
              <b>{t("Всё начинается с тебя", "It starts with you")}</b>
              <small>{t("Не с понедельника", "Not next Monday")}</small>
            </span>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-section">
        <div>
          <p className="eyebrow">{t("МЕНЬШЕ УСИЛИЙ НА ПЛАНИРОВАНИЕ", "LESS TIME PLANNING")}</p>
          <h2>{t("Больше жизни\nмежду галочками.", "More life\nbetween check-ins.")}</h2>
        </div>
        <div className="feature-grid">
          {[
            [
              "01",
              t("Начни с одной привычки", "Start with one habit"),
              t(
                "Выбери то, что важно именно тебе. Стакан воды — уже хорошее начало.",
                "Choose what matters to you. A glass of water is a good place to start.",
              ),
              "leaf",
            ],
            [
              "02",
              t("Найди свой ритм", "Find your rhythm"),
              t(
                "Каждый день или несколько раз в неделю. Паузы тоже помещаются в план.",
                "Every day or a few times a week. Your plan has room for pauses, too.",
              ),
              "sun",
            ],
            [
              "03",
              t("Замечай, как меняешься", "Notice your growth"),
              t(
                "Смотри на свой путь целиком. Один пропущенный день не перечёркивает всё.",
                "See the whole journey. One missed day doesn’t erase your progress.",
              ),
              "chart",
            ],
          ].map(([number, title, body, icon]) => (
            <article key={number}>
              <div>
                <span>{number}</span>
                <Icon name={icon!} size={25} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="privacy-section">
        <div className="privacy-symbol">
          <Icon name="shield" size={52} />
        </div>
        <div>
          <p className="eyebrow">{t("СНАЧАЛА ТВОЁ УСТРОЙСТВО", "YOUR DEVICE COMES FIRST")}</p>
          <h2>{t("Твои привычки.\nТвоё пространство.", "Your habits.\nYour space.")}</h2>
          <p>
            {t(
              "В этом демо всё сохраняется в браузере. В будущем приложении локальная работа останется основой, а аккаунт добавит резервную копию и синхронизацию между устройствами.",
              "This demo saves everything in your browser. The planned app will work locally first, with an optional account for backup and syncing across devices.",
            )}
          </p>
          <span className="coming-tag">
            {t(
              "iOS · Android · Веб · Telegram — планируемые платформы",
              "iOS · Android · Web · Telegram — planned platforms",
            )}
          </span>
        </div>
      </section>
      <section id="faq" className="faq-section">
        <p className="eyebrow">{t("ПАРА ОТВЕТОВ", "A FEW ANSWERS")}</p>
        <h2>{t("Без лишних вопросов.", "A little more clarity.")}</h2>
        {[
          [
            t("Нужно создавать аккаунт?", "Do I need an account?"),
            t(
              "Для этого демо — нет. Создавай привычки сразу. В будущем приложении аккаунт будет нужен только для облачных возможностей.",
              "Not for this demo. Start creating habits right away. In the planned app, an account will only be needed for cloud features.",
            ),
          ],
          [
            t("Что происходит, если я пропущу день?", "What if I skip a day?"),
            t(
              "Осознанный пропуск исключается из процента выполнения и сохраняет серию. Просто неотмеченный прошедший день считается невыполненным.",
              "An intentional skip is excluded from completion rates and preserves your streak. A past day with no check-in counts as incomplete.",
            ),
          ],
          [
            t("Где хранятся данные демо?", "Where is my demo data stored?"),
            t(
              "В локальном хранилище этого браузера. Они не отправляются на сервер. Очистка данных браузера удалит их; кнопка сброса вернёт исходные примеры.",
              "In this browser’s local storage. Nothing is sent to a server. Clearing browser data removes them; the reset button restores the sample data.",
            ),
          ],
          [
            t("Можно уже скачать приложение?", "Can I download the app?"),
            t(
              "Это сравнение трёх дизайн-концепций. Готового релиза для скачивания здесь пока нет. Все кнопки ведут в интерактивное демо.",
              "This is a comparison of three design concepts. A finished app download is not available here yet. All action buttons open the interactive demo.",
            ),
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <Icon name="plus" size={18} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="landing-cta">
        <Icon name="leaf" size={32} />
        <h2>{t("Пусть сегодня будет\nчуть больше твоим.", "Make today\na little more yours.")}</h2>
        <button className="primary-button" onClick={onNew}>
          {t("Сделать первый шаг", "Take the first step")}
          <Icon name="arrow" size={18} />
        </button>
      </section>
      <footer className="landing-footer">
        <b>ownday.</b>
        <span>
          {t(
            "Дизайн-концепция. Все данные демонстрационные.",
            "Design concept. All data is for demonstration.",
          )}
        </span>
        <button className="text-button" onClick={onStart}>
          {t("Вернуться к приложению", "Back to the app")}
          <Icon name="arrow" size={16} />
        </button>
      </footer>
    </main>
  );
}
