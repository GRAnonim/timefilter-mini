(function () {
  const L = window.TimeFilter;
  const root = document.getElementById("app");
  const tg = window.Telegram && window.Telegram.WebApp;
  const insideTelegram = Boolean(tg && tg.initData);

  let data = { goals: [], events: [] };
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
    else if (act === "goals") open({ name: "goals" });
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
    return homeScreen();
  }

  function homeScreen() {
    if (data.goals.length < 2) return goalsScreen(true);
    const line = data.goals.map(esc).join(" · ");
    return (
      '<p class="kicker">Фильтр времени</p>' +
      "<h1>Что пришло?</h1>" +
      '<button class="goals-strip" data-act="goals"><span>Цели на полгода</span><strong>' + line + "</strong></button>" +
      '<div class="stack">' +
        card("work", "Работа", "Встречи, задачи, проекты") +
        card("family", "Семья", "Просьбы и встречи близких") +
        card("friend", "Друзья", "Гости, кино, «давай увидимся»") +
      "</div>" +
      '<div class="footer-links">' +
        '<button class="textbtn" data-act="reports">Отчёт</button>' +
        '<button class="textbtn" data-act="stats">Сводка</button>' +
      "</div>"
    );
  }

  function card(kind, title, text) {
    return '<button class="tap ' + kind + '" data-act="describe" data-kind="' + kind + '"><strong>' + title + "</strong><span>" + text + "</span></button>";
  }

  function goalsScreen(embedded) {
    const values = [data.goals[0] || "", data.goals[1] || "", data.goals[2] || ""];
    return (
      (embedded ? "" : navBack()) +
      '<p class="kicker">Ориентиры</p>' +
      "<h1>Две цели на полгода</h1>" +
      '<p class="lead">На них будем смотреть, когда придёт приглашение. Третья — если нужна.</p>' +
      field("Первая", "g1", values[0], "Закрыть диплом") +
      field("Вторая", "g2", values[1], "Английский") +
      field("Третья, если нужна", "g3", values[2], "Можно оставить пустой") +
      '<p class="error" id="goal-error" hidden></p>' +
      '<div class="stack"><button class="choice primary" data-act="save-goals">Сохранить</button></div>'
    );
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
    save().then(home);
  }

  function describeScreen() {
    const meta = L.KIND_META[view.kind];
    return (
      navBack() +
      '<p class="kicker">' + esc(meta.mark) + "</p>" +
      "<h1>Как это называется?</h1>" +
      '<p class="lead">Одно-два слова, чтобы потом узнать.</p>' +
      '<label class="lbl" for="desc">Ситуация</label>' +
      '<textarea id="desc" data-focus maxlength="500" placeholder="Созвон в четверг"></textarea>' +
      '<p class="error" id="desc-error" hidden></p>' +
      '<div class="stack"><button class="choice primary" data-act="save-text">Дальше</button></div>'
    );
  }

  function saveTyped() {
    if (view.name === "describe") {
      const text = document.getElementById("desc").value.trim();
      const error = document.getElementById("desc-error");
      if (text.length < 3) {
        error.hidden = false;
        error.textContent = "Напиши хотя бы пару слов.";
        return;
      }
      open({ name: "question", kind: view.kind, description: text, answers: {} });
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
    return (
      navBack() +
      '<div class="track" aria-hidden="true"><span style="width:' + Math.round(progress.ratio * 100) + '%"></span></div>' +
      '<p class="sr">Вопрос ' + progress.current + " из " + progress.total + "</p>" +
      '<p class="step">' + esc(title) + "</p>" +
      "<h2>" + esc(question.prompt) + "</h2>" +
      note +
      '<div class="choices ' + layout + '">' + chips + "</div>" +
      free
    );
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
    return navBack() + '<p class="kicker">Сводка</p><h1>' + esc(report.title) + "</h1>" + '<div class="chips">' + chips + "</div>" + body;
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(phrase).then(done, done);
    } else if (tg && tg.showAlert) {
      tg.showAlert(phrase);
    }
  }

  window.TimeStore.load().then(function (loaded) {
    data = loaded;
    render();
  });
})();
