"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./public-home.module.css";
function Sprig() {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 260" fill="none">
      <path
        d="M108 250C92 164 122 78 173 15M110 185C31 181 16 136 26 91c73 3 97 40 84 94ZM123 127c-3-68 38-100 89-91 3 51-34 90-89 91ZM109 236c-3-54-42-89-94-75 5 43 38 72 94 75Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export function PublicHome() {
  const [locale, setLocale] = useState<"ru" | "en">("ru"),
    [night, setNight] = useState(false),
    [checks, setChecks] = useState([false, false, false]);
  const t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  useEffect(() => {
    setLocale(document.documentElement.lang === "en" ? "en" : "ru");
    setNight(
      document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
          window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, []);
  function language() {
    const next = locale === "ru" ? "en" : "ru";
    setLocale(next);
    document.documentElement.lang = next;
    document.cookie = `ownday_locale=${next};Path=/;SameSite=Lax;Max-Age=31536000`;
  }
  function appearance() {
    const next = !night;
    setNight(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.cookie = `ownday_theme=${next ? "dark" : "light"};Path=/;SameSite=Lax;Max-Age=31536000`;
  }
  const habits = [
    t("Стакан воды после пробуждения", "Water after waking up"),
    t("Десять минут для книги", "Ten minutes with a book"),
    t("Немного побыть на воздухе", "A little time outside"),
  ];
  return (
    <div className={styles.site} data-night={night}>
      <a className={styles.skip} href="#main">
        {t("К содержимому", "Skip to content")}
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Ownday">
          ownday.
        </Link>
        <nav aria-label={t("Навигация по сайту", "Website navigation")}>
          <a href="#how">{t("Как это работает", "How it works")}</a>
          <a href="#questions">{t("Вопросы", "Questions")}</a>
        </nav>
        <div className={styles.tools}>
          <button onClick={language} aria-label={t("Switch to English", "Переключить на русский")}>
            {locale === "ru" ? "EN" : "RU"}
          </button>
          <button
            onClick={appearance}
            aria-label={t(
              night ? "Светлая тема" : "Тёмная тема",
              night ? "Light theme" : "Dark theme",
            )}
          >
            {night ? "☀" : "☾"}
          </button>
          <Link href="/today">
            {t("Войти", "Sign in")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              {t("МАЛЕНЬКИЕ ПРИВЫЧКИ. ТВОЯ ЖИЗНЬ.", "SMALL HABITS. YOUR LIFE.")}
            </p>
            <h1>
              {t("Каждый день —", "Every day,")}
              <br />
              <em>{t("чуть ближе", "a little closer")}</em>
              <br />
              {t("к себе.", "to yourself.")}
            </h1>
            <p className={styles.lead}>
              {t(
                "Не нужно становиться другим человеком с понедельника. Найди место для того, что важно тебе. По одной привычке, в своём ритме.",
                "You don’t need to become someone else on Monday. Make room for what matters to you. One habit at a time, at your own pace.",
              )}
            </p>
            <a className={styles.primary} href="#try">
              {t("Попробовать свой день", "Try your day")} <span aria-hidden="true">↗</span>
            </a>
            <p className={styles.caption}>
              {t("Интерактивное демо · без регистрации", "Interactive demo · no account needed")}
            </p>
            <div className={styles.release}>
              {t(
                "Готовим приложение для iOS и Android.",
                "The iOS and Android app is in development.",
              )}{" "}
              <a href="#how">{t("Что внутри", "What’s inside")}</a>
            </div>
          </div>
          <div className={styles.previewArea} id="try">
            <div className={styles.sprig}>
              <Sprig />
            </div>
            <div className={styles.note}>
              {t("Не идеально. По-настоящему.", "Not perfect. Just yours.")}
            </div>
            <div className={styles.preview}>
              <div className={styles.previewTop}>
                <span className={styles.wordmark}>ownday.</span>
                <span>{t("ДЕМО", "DEMO")}</span>
              </div>
              <p className={styles.eyebrow}>
                {t("СЕГОДНЯ ЕСТЬ МЕСТО ДЛЯ ТЕБЯ", "TODAY HAS ROOM FOR YOU")}
              </p>
              <h2>
                {t("В твоём", "At your")}
                <br />
                {t("ритме.", "own pace.")}
              </h2>
              <div className={styles.dayProgress}>
                <span>{t("Мой день", "My day")}</span>
                <span aria-live="polite">{checks.filter(Boolean).length} / 3</span>
              </div>
              <div className={styles.previewHabits}>
                {habits.map((habit, i) => (
                  <button
                    key={i}
                    aria-pressed={checks[i]}
                    onClick={() =>
                      setChecks((previous) =>
                        previous.map((value, index) => (index === i ? !value : value)),
                      )
                    }
                  >
                    <span className={styles.check} aria-hidden="true">
                      {checks[i] ? "✓" : ""}
                    </span>
                    <span>
                      <small>
                        {i === 0
                          ? t("УТРО", "MORNING")
                          : i === 1
                            ? t("ДЕНЬ", "AFTERNOON")
                            : t("ВЕЧЕР", "EVENING")}
                      </small>
                      <b>{habit}</b>
                    </span>
                  </button>
                ))}
              </div>
              <p className={styles.encouragement} aria-live="polite">
                {checks.every(Boolean)
                  ? t("Хороший день. И он твой.", "A good day. And it’s yours.")
                  : t("Маленький шаг тоже считается.", "A small step counts, too.")}
              </p>
              <button className={styles.reset} onClick={() => setChecks([false, false, false])}>
                {t("Начать демо заново", "Reset demo")}
              </button>
            </div>
          </div>
        </section>
        <section className={styles.manifesto} id="how">
          <p className={styles.eyebrow}>
            {t("МЕНЬШЕ ДАВЛЕНИЯ. БОЛЬШЕ ЖИЗНИ.", "LESS PRESSURE. MORE LIFE.")}
          </p>
          <h2>
            {t("Привычки, которые", "Habits that")}
            <br />
            <em>{t("подходят тебе.", "fit your life.")}</em>
          </h2>
          <p>
            {t(
              "В Ownday день начинается с простого вопроса: что я хочу сделать для себя сегодня?",
              "In Ownday, the day begins with a simple question: what would I like to do for myself today?",
            )}
          </p>
        </section>
        <section
          className={styles.features}
          aria-label={t("Возможности приложения", "App features")}
        >
          {[
            [
              "01",
              t("Начни с малого", "Start small"),
              t(
                "Выбери готовую привычку или придумай свою. Стакан воды, книга, прогулка — цель задаёшь ты.",
                "Pick a template or make it your own. Water, reading, a walk — you set the goal.",
              ),
            ],
            [
              "02",
              t("Живи своим днём", "Find your rhythm"),
              t(
                "Утро, день и вечер. Отметки, счётчики и осознанные пропуски. Можно передумать и отменить действие.",
                "Morning, afternoon, evening. Check-ins, counters and intentional pauses. You can always undo a check-in.",
              ),
            ],
            [
              "03",
              t("Замечай, что растёт", "Notice your growth"),
              t(
                "Календарь и личная статистика показывают весь путь. Пауза не перечёркивает уже сделанное.",
                "Your calendar and personal progress show the whole journey. A pause doesn’t erase the effort you’ve made.",
              ),
            ],
          ].map(([number, title, body]) => (
            <article key={number}>
              <span className={styles.featureNumber}>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>
        <section className={styles.offline}>
          <div>
            <p className={styles.eyebrow}>{t("ТВОЁ ЛИЧНОЕ ПРОСТРАНСТВО", "YOUR PERSONAL SPACE")}</p>
            <h2>
              {t("Сначала ты.", "You come first.")}
              <br />
              {t("Аккаунт — по желанию.", "An account is optional.")}
            </h2>
          </div>
          <div>
            <p>
              {t(
                "В мобильном приложении привычки и история сохраняются на устройстве. Создавай, отмечай и смотри прогресс даже без интернета.",
                "In the mobile app, habits and history are saved on your device. Create habits, check in and view progress even without internet.",
              )}
            </p>
            <p>
              {t(
                "Когда понадобится второе устройство, добавь аккаунт. Он открывает синхронизацию, сохраняя твой путь.",
                "When you want a second device, add an account. It enables sync while keeping your journey intact.",
              )}
            </p>
            <Link href="/privacy">{t("Как хранятся данные", "How data is stored")} ↗</Link>
          </div>
        </section>
        <section className={styles.faq} id="questions">
          <div>
            <p className={styles.eyebrow}>{t("МОЖНО СПРОСИТЬ", "GOOD QUESTIONS")}</p>
            <h2>
              {t("Всё начинается", "It starts")}
              <br />
              {t("с простого.", "simply.")}
            </h2>
          </div>
          <div>
            {[
              [
                t("Нужна ли регистрация?", "Do I need an account?"),
                t(
                  "Для мобильного приложения — нет. Аккаунт нужен для синхронизации между устройствами. Веб-приложение использует аккаунт.",
                  "No account is needed in the mobile app. An account enables sync between devices. The web app requires an account.",
                ),
              ],
              [
                t("Что будет без интернета?", "What happens without internet?"),
                t(
                  "Локальные привычки и отметки остаются доступны. После восстановления связи приложение повторит отправку сохранённых изменений.",
                  "Local habits and check-ins stay available. The app retries saved changes when your connection returns.",
                ),
              ],
              [
                t("А если я пропущу день?", "What if I skip a day?"),
                t(
                  "Можно отметить осознанный пропуск. Он отличается от невыполненной привычки и не прерывает серию. История остаётся с тобой.",
                  "You can mark an intentional skip. It is different from a missed habit and does not break a streak. Your history stays with you.",
                ),
              ],
              [
                t("Где скачать приложение?", "Where can I download the app?"),
                t(
                  "Мы готовим первый выпуск для iOS и Android. Ссылки на магазины появятся здесь после публикации. Сейчас можно попробовать интерактивное демо выше или войти в веб-версию.",
                  "We’re preparing the first iOS and Android release. Store links will appear here after publication. For now, try the interactive demo above or sign in to the web app.",
                ),
              ],
              [
                t("Можно забрать свои данные?", "Can I take my data with me?"),
                t(
                  "В настройках мобильного приложения есть экспорт привычек и истории в JSON. При конфликте синхронизации экспорт также сохраняет обе версии изменения.",
                  "Mobile settings include a JSON export of habits and history. If a sync conflict occurs, the export also preserves both versions of the change.",
                ),
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.closing}>
          <Sprig />
          <h2>
            {t("Сегодня — хороший день", "Today is a good day")}
            <br />
            {t("для маленького начала.", "for a small beginning.")}
          </h2>
          <a href="#try" className={styles.primary}>
            {t("Сделать первый шаг", "Take the first step")} ↗
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link href="/" className={styles.wordmark}>
          ownday.
        </Link>
        <span>{t("В твоём ритме.", "At your own pace.")}</span>
        <nav>
          <Link href="/support">{t("Поддержка", "Support")}</Link>
          <Link href="/privacy">{t("Данные и приватность", "Data & privacy")}</Link>
          <a href="https://github.com/imalisherbekenov/ownday">GitHub ↗</a>
        </nav>
      </footer>
    </div>
  );
}
