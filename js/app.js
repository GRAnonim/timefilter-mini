(function () {
  const L = window.TimeFilter;
  const root = document.getElementById("app");
  const tg = window.Telegram && window.Telegram.WebApp;
  const insideTelegram = Boolean(tg && tg.initData);

  let data = { goals: [], events: [], goalMonths: 6 };
  let goalDraft = null;
  let view = { name: "home" };
  const stack = [];

  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    tg.BackButton.onClick(back);
    if (tg.onEvent) tg.onEvent("themeChanged", render);
  }

  document.documentElement.classList.toggle("dark", (tg && tg.colorScheme === "dark") || (!tg && window.matchMedia("(prefers-color-scheme: dark)").matches));

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function haptic() {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  }

  function open(next, replace) {
    if (!replace) stack.push(view);
    view = next;
    render();
  }

  function back() {
    if (!stack.length) {
      if (view.name !== "home") open({ name: "home" }, true);
      return;
    }
    view = stack.pop();
    render();
  }

  function home() {
    stack.length = 0;
    open({ name: "home" }, true);
  }

  function isDark() {
    if (tg && tg.colorScheme) return tg.colorScheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncChrome() {
    const dark = isDark();
    document.documentElement.classList.toggle("dark", dark);
    const bg = dark ? "#0c1016" : "#e7eef6";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", bg);
    if (!tg) return;
    if (view.name === "home") tg.BackButton.hide();
    else tg.BackButton.show();
    try {
      if (tg.setHeaderColor) tg.setHeaderColor(bg);
      if (tg.setBackgroundColor) tg.setBackgroundColor(bg);
      if (tg.setBottomBarColor) tg.setBottomBarColor(bg);
    } catch (error) {
      /* Старые клиенты Telegram принимают только свои имена цветов. */
    }
  }

  function save() {
    return window.TimeStore.save(data);
  }

  function eventById(id) {
    return data.events.filter(function (event) { return event.id === id; })[0];
  }

  root.addEventListener("click", function (event) {
    const button = event.target.closest("[data-act]");
    if (!button) return;
    haptic();
    const act = button.dataset.act;
    if (act === "home") home();
    else if (act === "back") back();
    else if (act === "goals") {
      goalDraft = null;
      open({ name: "goals" });
    }
    else if (act === "months") changeMonths(Number(button.dataset.delta));
    else if (act === "skip-desc") skipDescription();
    else if (act === "describe") open({ name: "describe", kind: button.dataset.kind });
    else if (act === "stats") open({ name: "stats", period: "week" });
    else if (act === "period") open({ name: "stats", period: button.dataset.period }, true);
    else if (act === "reports") open({ name: "reports" });
    else if (act === "begin-feedback") open({ name: "feedback", eventId: button.dataset.id, answers: {} });
    else if (act === "answer") onAnswer(button.dataset.value, button.dataset.label);
    else if (act === "decision") onDecision(button.dataset.value);
    else if (act === "guilt") onGuilt(button.dataset.value);
    else if (act === "copy") copyPhrase(button.dataset.phrase);
    else if (act === "save-goals") saveGoals();
    else if (act === "save-text") saveTyped();
    else if (act === "reset-ask") open({ name: "reset" });
    else if (act === "reset-do") resetAll();
    else if (act === "export") exportSummary();
  });

  function render() {
    syncChrome();
    const banner = insideTelegram ? "" : '<p class="banner">Так экран выглядит в Telegram. Открывается кнопкой у поля сообщения.</p>';
    root.innerHTML = '<main class="screen">' + screen() + "</main>" + banner;
    const box = root.querySelector("[data-focus]");
    if (box) box.focus();
  }

  function screen() {
    if (view.name === "goals") return goalsScreen();
    if (view.name === "describe") return describeScreen();
    if (view.name === "question") return questionScreen(L.SCENARIOS[view.kind], false);
    if (view.name === "advice") return adviceScreen();
    if (view.name === "guilt") return guiltScreen();
    if (view.name === "noted") return notedScreen();
    if (view.name === "done-feedback") return doneFeedback();
    if (view.name === "reports") return reportsScreen();
    if (view.name === "feedback") return questionScreen(L.FEEDBACK, true);
    if (view.name === "stats") return statsScreen();
    if (view.name === "reset") return resetScreen();
    return homeScreen();
  }

  function homeScreen() {
    if (data.goals.length < 2) return goalsScreen(true);
    const lines = data.goals.map(function (goal) {
      return '<span class="goal-line">' + esc(goal) + "</span>";
    }).join("");
    return (
      '<p class="kicker">Фильтр времени</p>' +
      "<h1>Что пришло?</h1>" +
      '<button class="goals-strip" data-act="goals"><span class="goals-label">Цели на ' + esc(monthsPhrase(data.goalMonths)) + "</span>" + lines + "</button>" +
      '<div class="stack">' +
        card("work", "Работа", "Встречи, задачи, проекты") +
        card("family", "Семья", "Просьбы и встречи близких") +
        card("friend", "Друзья", "Гости, кино, «давай увидимся»") +
      "</div>" +
      '<div class="tools">' +
        '<button class="tool" data-act="reports">' + iconNote() + "<span>Отчёт</span></button>" +
        '<button class="tool" data-act="stats">' + iconChart() + "<span>Сводка</span></button>" +
      "</div>" +
      '<button class="textbtn reset-link" data-act="reset-ask">Начать заново</button>'
    );
  }

  function card(kind, title, text) {
    return '<button class="tap ' + kind + '" data-act="describe" data-kind="' + kind + '"><strong>' + title + "</strong><span>" + text + "</span></button>";
  }

  function goalsScreen(embedded) {
    const draft = ensureGoalDraft();
    const values = draft.values;
    const months = draft.months;
    return (
      (embedded ? "" : navBack()) +
      '<p class="kicker">Ориентиры</p>' +
      "<h1>Две или три цели</h1>" +
      '<p class="lead">На них будем смотреть, когда придёт приглашение.</p>' +
      '<div class="months">' +
        '<button class="stepper" type="button" data-act="months" data-delta="-1" aria-label="Короче"' + (months <= 3 ? " disabled" : "") + ">−</button>" +
        "<b>" + esc(monthsCount(months)) + "</b>" +
        '<button class="stepper" type="button" data-act="months" data-delta="1" aria-label="Дольше"' + (months >= 12 ? " disabled" : "") + ">+</button>" +
      "</div>" +
      '<p class="quote">' + esc(pick(GOAL_QUOTES, String(new Date().getDate()))) + "</p>" +
      field("Первая", "g1", values[0], "Закрыть диплом") +
      field("Вторая", "g2", values[1], "Английский") +
      field("Третья, если нужна", "g3", values[2], "Можно оставить пустой") +
      '<p class="error" id="goal-error" hidden></p>' +
      '<div class="stack"><button class="choice primary" data-act="save-goals">Сохранить</button></div>'
    );
  }

  function ensureGoalDraft() {
    if (!goalDraft) {
      goalDraft = {
        months: data.goalMonths || 6,
        values: [data.goals[0] || "", data.goals[1] || "", data.goals[2] || ""],
      };
    }
    return goalDraft;
  }

  function readGoalFields() {
    const draft = ensureGoalDraft();
    ["g1", "g2", "g3"].forEach(function (id, index) {
      const field = document.getElementById(id);
      if (field) draft.values[index] = field.value;
    });
  }

  function changeMonths(delta) {
    const draft = ensureGoalDraft();
    readGoalFields();
    draft.months = Math.min(12, Math.max(3, draft.months + delta));
    render();
  }

  function monthsCount(months) {
    const mod10 = months % 10;
    const mod100 = months % 100;
    if (mod10 === 1 && mod100 !== 11) return months + " месяц";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return months + " месяца";
    return months + " месяцев";
  }

  function monthsPhrase(months) {
    if (months === 12) return "год";
    return monthsCount(months);
  }

  function pick(list, seed) {
    let index = 0;
    const text = String(seed || "");
    for (let i = 0; i < text.length; i += 1) index = (index + text.charCodeAt(i)) % list.length;
    return list[index % list.length];
  }

  const GOAL_QUOTES = [
    "Срок делает цель яснее.",
    "Две ясные цели лучше десяти размытых.",
    "Направление важнее скорости.",
    "Малый честный шаг лучше громкого обещания.",
    "Выбранный срок бережёт силы: не надо решать всё сразу.",
  ];

  const DECISION_QUOTES = {
    go: [
      "Можно согласиться. Можно и отказаться — без вины.",
      "Отказ от встречи не делает тебя плохим.",
      "Если сил нет, честное нет лучше усталого да.",
    ],
    decline: [
      "Отказ от встречи не отменяет уважения к человеку.",
      "Честное нет бережнее, чем согласие без сил.",
      "Беречь силы — тоже ответственность.",
      "Спокойный отказ оставляет место для настоящего согласия.",
      "Короткого объяснения достаточно.",
    ],
    postpone: [
      "Не сейчас — не значит никогда.",
      "Другое время — тоже ответ, не побег.",
      "Отложить можно спокойно.",
    ],
  };

  function iconNote() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h6.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 20V5A1.5 1.5 0 0 1 8.5 3.5H8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3.8V8h4.2M9 12.5h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function iconChart() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 19h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function navBack() {
    if (insideTelegram) return "";
    return '<button class="textbtn" data-act="back">Назад</button>';
  }

  function field(label, id, value, placeholder) {
    return '<label class="lbl" for="' + id + '">' + label + '</label><input id="' + id + '" type="text" maxlength="200" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '">';
  }

  function saveGoals() {
    const goals = ["g1", "g2", "g3"].map(function (id) {
      return document.getElementById(id).value.trim();
    }).filter(Boolean);
    const error = document.getElementById("goal-error");
    if (goals.length < 2) {
      error.hidden = false;
      error.textContent = "Нужны хотя бы две цели.";
      return;
    }
    data.goals = goals.slice(0, 3);
    data.goalMonths = ensureGoalDraft().months;
    goalDraft = null;
    save().then(home);
  }

  function describeScreen() {
    const meta = L.KIND_META[view.kind];
    const preview = nextSituationName();
    return (
      navBack() +
      '<p class="kicker">' + esc(meta.mark) + "</p>" +
      "<h1>Как это называется?</h1>" +
      '<p class="lead">Необязательно. Если пропустить, будет «' + esc(preview) + "».</p>" +
      '<label class="lbl" for="desc">Комментарий</label>' +
      '<textarea id="desc" maxlength="500" placeholder="Например, созвон в четверг"></textarea>' +
      '<div class="stack">' +
        '<button class="choice primary" data-act="save-text">Дальше</button>' +
        '<button class="choice quiet" data-act="skip-desc">Пропустить</button>' +
      "</div>"
    );
  }

  function saveTyped() {
    if (view.name === "describe") {
      const text = document.getElementById("desc").value.trim();
      open({ name: "question", kind: view.kind, description: text || nextSituationName(), answers: {} });
      return;
    }
    const typed = document.getElementById("free");
    const text = typed ? typed.value.trim() : "";
    if (!text) return;
    const questions = view.name === "feedback" ? L.FEEDBACK : L.SCENARIOS[view.kind];
    const question = L.nextQuestion(questions, view.answers);
    const answers = Object.assign({}, view.answers);
    answers[question.key] = text.slice(0, 300);
    advance(answers);
  }

  function skipDescription() {
    open({ name: "question", kind: view.kind, description: nextSituationName(), answers: {} });
  }

  function nextSituationName() {
    let max = 0;
    data.events.forEach(function (event) {
      const match = /^Ситуация (\d+)$/.exec(String(event.description || "").trim());
      if (match) max = Math.max(max, Number(match[1]));
    });
    return "Ситуация " + (max + 1);
  }

  function questionScreen(questions, feedback) {
    const question = L.nextQuestion(questions, view.answers);
    if (!question) return "";
    const options = question.options || [];
    const short = options.every(function (option) { return option.label.length <= 16; });
    const layout = options.length === 2 ? "pair" : (options.length >= 4 && short ? "grid" : "");
    const chips = options.map(function (option) {
      return '<button class="choice" data-act="answer" data-value="' + esc(option.value) + '" data-label="' + esc(option.label) + '">' + esc(option.label) + "</button>";
    }).join("");
    const free = question.kind === "text"
      ? '<label class="lbl" for="free">Или своими словами</label><textarea id="free" maxlength="300" placeholder="Коротко"></textarea><div class="stack"><button class="choice primary" data-act="save-text">Дальше</button></div>'
      : "";
    const title = feedback ? "Отчёт" : L.KIND_META[view.kind].mark;
    const progress = stepProgress(questions, view.answers);
    const note = feedback ? '<p class="lead">' + esc(clip(eventById(view.eventId).description, 140)) + "</p>" : "";
    const goalsHint = question.key === "related" ? goalRecall() : "";
    return (
      navBack() +
      '<div class="track" aria-hidden="true"><span style="width:' + Math.round(progress.ratio * 100) + '%"></span></div>' +
      '<p class="sr">Вопрос ' + progress.current + " из " + progress.total + "</p>" +
      '<p class="step">' + esc(title) + "</p>" +
      "<h2>" + esc(question.prompt) + "</h2>" +
      note +
      goalsHint +
      '<div class="choices ' + layout + '">' + chips + "</div>" +
      free
    );
  }

  function goalRecall() {
    if (!data.goals.length) return "";
    const lines = data.goals.map(function (goal) {
      return '<span class="goal-line">' + esc(goal) + "</span>";
    }).join("");
    return '<div class="goal-recall"><span class="goals-label">Твои цели</span>' + lines + "</div>";
  }

  function stepProgress(questions, answers) {
    let total = 0;
    let done = 0;
    questions.forEach(function (question) {
      const answered = Object.prototype.hasOwnProperty.call(answers, question.key);
      if (question.onlyIf && !question.onlyIf(answers) && !answered) return;
      total += 1;
      if (answered) done += 1;
    });
    const current = Math.min(total, done + 1);
    return { current: current, total: Math.max(total, 1), ratio: total ? current / total : 1 };
  }

  function onAnswer(value, label) {
    const questions = view.name === "feedback" ? L.FEEDBACK : L.SCENARIOS[view.kind];
    const question = L.nextQuestion(questions, view.answers);
    if (!question) return;
    const stored = question.kind === "choice" ? value : label;
    const answers = Object.assign({}, view.answers);
    answers[question.key] = stored;
    advance(answers);
  }

  function advance(answers) {
    const questions = view.name === "feedback" ? L.FEEDBACK : L.SCENARIOS[view.kind];
    if (L.nextQuestion(questions, answers)) {
      open(Object.assign({}, view, { answers: answers }), true);
      return;
    }
    if (view.name === "feedback") {
      const event = eventById(view.eventId);
      event.feedback = answers;
      save().then(function () { open({ name: "done-feedback", satisfaction: answers.satisfaction }); });
      return;
    }
    const advice = L.recommend(view.kind, answers);
    const event = {
      id: Date.now().toString(36),
      kind: view.kind,
      description: view.description,
      answers: answers,
      recommendation: advice.code,
      reasonTags: L.signalTags(view.kind, answers),
      decision: "",
      guilt: "",
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    data.events.push(event);
    save().then(function () { open({ name: "advice", eventId: event.id }, true); });
  }

  function adviceScreen() {
    if (view.name === "done-feedback") return doneFeedback();
    const event = eventById(view.eventId);
    const advice = L.recommend(event.kind, event.answers);
    const phrase = advice.phrase
      ? '<div class="phrase"><span class="hint">Можно ответить так</span><p>' + esc(advice.phrase) + '</p><button class="linkish" data-act="copy" data-phrase="' + esc(advice.phrase) + '">Скопировать</button></div>'
      : "";
    return (
      '<p class="kicker">' + esc(clip(event.description, 80)) + "</p>" +
      '<span class="verdict ' + advice.code + '">' + esc(advice.title) + "</span>" +
      '<p class="body">' + esc(advice.body) + "</p>" +
      '<p class="quote">' + esc(pick(DECISION_QUOTES[advice.code] || DECISION_QUOTES.postpone, event.id)) + "</p>" +
      phrase +
      '<div class="stack">' +
        '<button class="choice go" data-act="decision" data-value="planned">Запланировать</button>' +
        '<button class="choice stop" data-act="decision" data-value="declined">Отказаться</button>' +
        '<button class="choice later" data-act="decision" data-value="postponed">Перенести</button>' +
      "</div>" +
      '<div class="footer-links"><button class="textbtn" data-act="home">На главную</button></div>'
    );
  }

  function onDecision(decision) {
    const event = eventById(view.eventId);
    event.decision = decision;
    save().then(function () {
      if (decision === "declined") open({ name: "guilt", eventId: event.id });
      else open({ name: "noted", decision: decision, eventId: event.id });
    });
  }

  function guiltScreen() {
    if (view.name === "noted") return notedScreen();
    return (
      "<h1>Как с виной?</h1>" +
      '<p class="lead">Отказ от встречи — не отказ от человека.</p>' +
      '<div class="stack">' +
        '<button class="choice" data-act="guilt" data-value="none">Вины нет</button>' +
        '<button class="choice" data-act="guilt" data-value="passed">Была и прошла</button>' +
        '<button class="choice" data-act="guilt" data-value="still">Ещё есть</button>' +
        '<button class="choice quiet" data-act="guilt" data-value="skip">Пропустить</button>' +
      "</div>"
    );
  }

  function onGuilt(value) {
    const event = eventById(view.eventId);
    if (value !== "skip") event.guilt = value;
    const lines = {
      none: "Записал: вины нет.",
      passed: "Записал: вина была и уже прошла.",
      still: "Записал, что вина ещё есть. Это не значит, что отказ был ошибкой.",
      skip: "Хорошо, вину не записываю.",
    };
    save().then(function () { open({ name: "noted", decision: "declined", note: lines[value] }); });
  }

  function notedScreen() {
    const notes = {
      planned: "Встреча в списке запланированных. После неё открой отчёт.",
      postponed: "Встреча отмечена как перенос.",
      declined: view.note || "Встреча отмечена как отказ.",
    };
    return (
      "<h1>Отметил</h1>" +
      '<p class="body">' + esc(notes[view.decision] || view.note || "") + "</p>" +
      '<div class="stack"><button class="choice primary" data-act="home">На главную</button></div>'
    );
  }

  function doneFeedback() {
    const lines = {
      satisfied: "Похоже, время было не зря.",
      overspent: "Затрат вышло больше, чем отдачи. В похожей ситуации это уже знакомый сигнал.",
      unsure: "Пока неясно, стоило ли оно того. Это тоже честный итог.",
    };
    return (
      "<h1>Встреча разобрана</h1>" +
      '<p class="body">Так следующие решения будут точнее. ' + esc(lines[view.satisfaction] || "") + "</p>" +
      '<div class="stack"><button class="choice primary" data-act="home">На главную</button></div>'
    );
  }

  function reportsScreen() {
    const pending = data.events.filter(function (event) {
      return event.decision === "planned" && !event.feedback;
    }).slice().reverse();
    if (!pending.length) {
      const had = data.events.some(function (event) { return event.decision === "planned"; });
      return (
        navBack() +
        "<h1>Отчёты</h1>" +
        '<p class="body">' + (had ? "По всем запланированным встречам отчёт уже есть." : "Пока нет встреч, которые ты отметил как запланированные.") + "</p>"
      );
    }
    const list = pending.map(function (event) {
      const meta = L.KIND_META[event.kind];
      return '<button class="tap ' + event.kind + '" data-act="begin-feedback" data-id="' + esc(event.id) + '"><strong>' + esc(clip(event.description, 80)) + "</strong><span>" + esc(meta.label) + "</span></button>";
    }).join("");
    return navBack() + "<h1>По какой встрече?</h1>" + '<div class="stack">' + list + "</div>";
  }

  function statsScreen() {
    const report = L.summarize(data.events, data.goals, view.period || "week", new Date());
    const chips = L.PERIODS.map(function (period) {
      const on = period.key === (view.period || "week") ? " on" : "";
      return '<button class="chip' + on + '" data-act="period" data-period="' + period.key + '">' + period.title + "</button>";
    }).join("");
    let body = '<p class="lead">' + esc(report.range) + "</p>";
    if (report.empty) {
      body += '<p class="body">' + esc(report.empty) + "</p>";
    } else {
      body += '<p class="body">' + esc(report.progress) + "</p>";
      body += statBlock("Ситуаций: " + report.total, report.kinds.map(function (kind) {
        return kind.label + " " + kind.count;
      }).join(" · "));
      body += bars("Рекомендации", report.recommendations);
      body += bars("Твои отметки", report.decisions);
      if (report.reasons.length) {
        body += statBlock("Почему получался отказ", report.reasons.map(function (reason) {
          return reason.label + " — " + reason.count;
        }).join("<br>"));
      }
      if (report.feedback) {
        const fb = report.feedback;
        body += statBlock("После встреч", "Отчётов: " + fb.total + "<br>Удовлетворён: " + fb.satisfied + " · затрат больше: " + fb.overspent + "<br>Доля удовлетворённых: " + fb.percent + "%");
      }
      if (report.time) {
        const bits = [];
        if (report.time.spent) bits.push("На запланированное ушло около " + report.time.spent);
        if (report.time.saved) bits.push("Отказы сохранили около " + report.time.saved);
        body += statBlock("Время", bits.join("<br>"));
      }
      if (report.goalsMatch) {
        body += statBlock("Цели", "Рабочие ситуации совпали с целями: " + report.goalsMatch.aligned + " из " + report.goalsMatch.total);
      }
      if (report.guilt) {
        body += statBlock("Вина после отказа", "Не было " + report.guilt.none + " · прошла " + report.guilt.passed + " · ещё есть " + report.guilt.still);
      }
    }
    return navBack() + '<p class="kicker">Сводка</p><h1>' + esc(report.title) + "</h1>" + '<div class="chips">' + chips + "</div>" + body + exportBlock();
  }

  function exportBlock() {
    if (!data.goals.length && !data.events.length) return "";
    return (
      '<div class="stack">' +
        '<button class="choice primary" data-act="export">Отправить сводку</button>' +
        '<p class="quote">Файл Word, без плагинов. Его можно переслать в чат.</p>' +
        '<p class="quote" id="export-note" hidden></p>' +
      "</div>"
    );
  }

  function resetScreen() {
    return (
      navBack() +
      "<h1>Начать заново?</h1>" +
      '<p class="lead">Цели, ситуации и сводка сотрутся. После этого можно заполнить всё с чистого листа.</p>' +
      '<div class="stack">' +
        '<button class="choice stop" data-act="reset-do">Сбросить всё</button>' +
        '<button class="choice quiet" data-act="home">Оставить как есть</button>' +
      "</div>"
    );
  }

  function resetAll() {
    data = { goals: [], events: [], goalMonths: 6 };
    goalDraft = null;
    stack.length = 0;
    window.TimeStore.clear().then(function () {
      view = { name: "home" };
      render();
    });
  }

  function statBlock(title, html) {
    return '<section class="stat card"><b>' + esc(title) + "</b><p>" + html + "</p></section>";
  }

  function bars(title, rows) {
    if (!rows.length) return "";
    const max = Math.max.apply(null, rows.map(function (row) { return row.count; }));
    const lines = rows.map(function (row) {
      const width = Math.max(8, Math.round(100 * row.count / max));
      return "<p>" + esc(row.label) + " · " + row.count + '</p><div class="meter"><span style="width:' + width + '%"></span></div>';
    }).join("");
    return '<section class="stat card"><b>' + esc(title) + "</b>" + lines + "</section>";
  }

  function clip(text, limit) {
    const compact = String(text || "").replace(/\s+/g, " ").trim();
    if (compact.length <= limit) return compact;
    return compact.slice(0, limit - 1) + "…";
  }

  function copyPhrase(phrase) {
    const done = function () {
      const button = root.querySelector("[data-act='copy']");
      if (button) button.textContent = "Скопировано";
    };
    return copyText(phrase).then(done, done);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("clipboard"));
  }

  const ADVICE_TITLES = {
    go: "Можно идти",
    decline: "Сейчас лучше отказаться",
    postpone: "Лучше выбрать другое время",
  };
  const DECISION_TITLES = {
    planned: "Запланировал",
    declined: "Отказался",
    postponed: "Перенёс",
  };
  const GUILT_TITLES = {
    none: "Вины не было",
    passed: "Вина была и прошла",
    still: "Вина ещё есть",
  };
  const FULL_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  function formatStamp(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.getDate() + " " + FULL_MONTHS[date.getMonth()] + " " + date.getFullYear();
  }

  function answerLines(questions, answers) {
    const lines = [];
    (questions || []).forEach(function (question) {
      if (!Object.prototype.hasOwnProperty.call(answers || {}, question.key)) return;
      const value = answers[question.key];
      const shown = question.kind === "choice" ? (L.optionLabel(question, value) || value) : value;
      lines.push(question.prompt + " — " + shown);
    });
    return lines;
  }

  function summaryText() {
    const now = new Date();
    const lines = [
      "Фильтр времени",
      "Сводка для разговора",
      formatStamp(now.toISOString()),
      "",
      "Цели на " + monthsPhrase(data.goalMonths),
    ];
    if (data.goals.length) data.goals.forEach(function (goal) { lines.push("— " + goal); });
    else lines.push("— не заданы");
    lines.push("", "Ситуации");
    if (!data.events.length) lines.push("Пока нет разобранных ситуаций.");
    data.events.slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    }).forEach(function (event, index) {
      const meta = L.KIND_META[event.kind] || { label: "Ситуация" };
      lines.push("");
      lines.push((index + 1) + ". " + (event.description || "Без названия"));
      lines.push(meta.label + (event.createdAt ? " · " + formatStamp(event.createdAt) : ""));
      if (event.recommendation) lines.push("Совет: " + (ADVICE_TITLES[event.recommendation] || event.recommendation));
      lines.push("Решение: " + (DECISION_TITLES[event.decision] || "ещё не отмечено"));
      if (event.guilt && GUILT_TITLES[event.guilt]) lines.push("После отказа: " + GUILT_TITLES[event.guilt]);
      answerLines(L.SCENARIOS[event.kind], event.answers).forEach(function (line) { lines.push(line); });
      if (event.feedback) {
        lines.push("После встречи:");
        answerLines(L.FEEDBACK, event.feedback).forEach(function (line) { lines.push(line); });
      }
    });
    lines.push("", "Эти ответы можно обсудить со специалистом.");
    return lines.join("\n");
  }

  function wordHtml(text) {
    const body = text.split("\n").map(function (line) {
      if (!line) return "<p>&nbsp;</p>";
      return "<p>" + esc(line) + "</p>";
    }).join("");
    return "<html><head><meta charset=\"utf-8\"><title>Фильтр времени</title></head><body style=\"font-family:Calibri,sans-serif;font-size:12pt\">" + body + "</body></html>";
  }

  function noteExport(message) {
    const note = document.getElementById("export-note");
    if (!note) return;
    note.hidden = false;
    note.textContent = message;
  }

  function downloadDoc(html) {
    const blob = new Blob(["\uFEFF" + html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "filtr-vremeni.doc";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportSummary() {
    const text = summaryText();
    const html = wordHtml(text);
    const file = new File(["\uFEFF" + html], "filtr-vremeni.doc", { type: "application/msword" });
    let shared = false;
    try {
      shared = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (error) {
      shared = false;
    }
    const afterCopy = function () {
      noteExport(shared ? "Файл можно отправить в чат." : "Файл Word сохранён. Текст сводки тоже скопирован — его можно вставить в чат.");
    };
    copyText(text).then(afterCopy, function () { noteExport("Файл Word сохранён. Его можно переслать в чат."); });
    if (shared) {
      navigator.share({ files: [file], title: "Фильтр времени", text: "Сводка, файл открывается в Word." }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        downloadDoc(html);
      });
      return;
    }
    downloadDoc(html);
  }

  window.TimeStore.load().then(function (loaded) {
    data = normalizeData(loaded);
    render();
  });

  function normalizeData(loaded) {
    const next = loaded || {};
    next.goals = next.goals || [];
    next.events = next.events || [];
    const months = Number(next.goalMonths);
    next.goalMonths = months >= 3 && months <= 12 ? Math.round(months) : 6;
    return next;
  }
})();
