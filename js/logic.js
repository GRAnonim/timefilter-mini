/* Те же правила, что в bot/logic.py. Мини-приложение считает совет само, без сервера. */
(function () {
  const YES_NO = [
    { value: "yes", label: "Да" },
    { value: "no", label: "Нет" },
  ];
  const YES_NO_UNSURE = YES_NO.concat([{ value: "unsure", label: "Не уверен" }]);
  const HOURS = [
    { value: "0.5", label: "30 мин" },
    { value: "1", label: "1 ч" },
    { value: "2", label: "2 ч" },
    { value: "3", label: "3 ч" },
    { value: "5", label: "5+ ч" },
    { value: "skip", label: "Не знаю" },
  ];

  const SCENARIOS = {
    work: [
      { key: "related", prompt: "Это связано с твоими целями?", kind: "choice", options: YES_NO },
      { key: "want", prompt: "Тебе действительно хочется туда пойти?", kind: "choice", options: YES_NO },
      {
        key: "obligation",
        prompt: "Чувствуешь, что должен согласиться из-за ожиданий других?",
        kind: "choice",
        options: YES_NO_UNSURE,
        onlyIf: function (answers) { return answers.want === "no"; },
      },
      {
        key: "gain",
        prompt: "Что ты получишь, если пойдёшь?",
        kind: "text",
        multi: true,
        options: [
          { value: "knowledge", label: "Новые знания" },
          { value: "contacts", label: "Контакты" },
          { value: "money", label: "Деньги" },
          { value: "experience", label: "Опыт" },
          { value: "nothing", label: "Ничего особенного" },
        ],
      },
      {
        key: "cost",
        prompt: "Что ты потратишь?",
        kind: "text",
        multi: true,
        options: [
          { value: "time", label: "Время" },
          { value: "energy", label: "Энергию" },
          { value: "money", label: "Деньги" },
          { value: "both", label: "Время и энергию" },
        ],
      },
      { key: "hours", prompt: "Примерно сколько часов это займёт?", kind: "choice", options: HOURS },
      {
        key: "more_important",
        prompt: "Есть ли более важные дела на сегодня или на эту неделю?",
        kind: "choice",
        options: YES_NO,
      },
    ],
    family: [
      { key: "responsibility", prompt: "Это твоя прямая ответственность?", kind: "choice", options: YES_NO },
      { key: "want", prompt: "Ты хочешь сейчас увидеть их или помочь?", kind: "choice", options: YES_NO },
      { key: "resources", prompt: "Есть ли сейчас ресурс: время и силы?", kind: "choice", options: YES_NO },
      {
        key: "harm",
        prompt: "Если отказаться сейчас, отношениям будет серьёзный вред?",
        kind: "choice",
        options: YES_NO,
      },
      { key: "hours", prompt: "Примерно сколько часов это займёт?", kind: "choice", options: HOURS },
    ],
    friend: [
      { key: "want", prompt: "Тебе хочется этой встречи?", kind: "choice", options: YES_NO },
      { key: "energy", prompt: "Есть сейчас энергия и время на это?", kind: "choice", options: YES_NO },
      {
        key: "motive",
        prompt: "Откуда согласие?",
        kind: "choice",
        options: [
          { value: "want", label: "Хочу" },
          { value: "must", label: "Должен" },
          { value: "guilt", label: "Вина" },
        ],
      },
      {
        key: "would_go",
        prompt: "Если бы человек точно не обиделся, ты бы пошёл?",
        kind: "choice",
        options: YES_NO,
      },
      { key: "hours", prompt: "Примерно сколько часов это займёт?", kind: "choice", options: HOURS },
    ],
  };

  const FEEDBACK = [
    {
      key: "gained",
      prompt: "Что ты получил? Знания, эмоции, помощь — как было на самом деле.",
      kind: "text",
      options: [
        { value: "knowledge", label: "Новые знания" },
        { value: "emotions", label: "Эмоции" },
        { value: "help", label: "Помощь" },
        { value: "contacts", label: "Контакты" },
        { value: "little", label: "Мало что" },
      ],
    },
    {
      key: "spent",
      prompt: "Что ты потратил?",
      kind: "text",
      options: [
        { value: "time", label: "Время" },
        { value: "energy", label: "Силы" },
        { value: "money", label: "Деньги" },
        { value: "both", label: "Время и силы" },
      ],
    },
    { key: "hours", prompt: "Сколько часов ушло по факту?", kind: "choice", options: HOURS },
    {
      key: "satisfaction",
      prompt: "Как ты после этой встречи?",
      kind: "choice",
      options: [
        { value: "satisfied", label: "Удовлетворён" },
        { value: "overspent", label: "Затратил больше, чем получил" },
        { value: "unsure", label: "Неопределённо" },
      ],
    },
    {
      key: "repeat",
      prompt: "Хочешь повторить похожую встречу?",
      kind: "choice",
      options: [
        { value: "yes", label: "Да" },
        { value: "sometimes", label: "Иногда" },
        { value: "no", label: "Нет" },
      ],
    },
  ];

  const KIND_META = {
    work: { label: "Работа", mark: "Работа", tone: "work" },
    family: { label: "Родственники", mark: "Семья", tone: "family" },
    friend: { label: "Друзья", mark: "Друзья", tone: "friend" },
  };

  const TITLES = {
    go: "Можно идти",
    decline: "Сейчас лучше отказаться",
    postpone: "Лучше выбрать другое время",
  };

  const TAG_LABELS = {
    not_goals: "не связано с целями",
    no_desire: "нет желания",
    obligation: "из чувства долга",
    more_important: "есть более важное",
    no_energy: "нет сил или времени",
    guilt: "из чувства вины",
    would_not_go: "без давления не пошёл бы",
  };

  const REFUSAL_TAGS = [
    "not_goals", "no_desire", "no_energy", "obligation", "guilt", "more_important", "would_not_go",
  ];

  const THEMES = [
    ["усталость", ["устал", "устала", "выгор", "нет сил", "вымот"]],
    ["обучение", ["выуч", "узнал", "узнала", "знан", "понял", "поняла", "навык"]],
    ["радость", ["радост", "приятн", "вдохнов", "кайф"]],
    ["вина", ["вина", "вину", "вины", "стыд"]],
    ["деньги", ["деньг", "оплат", "зарплат"]],
    ["контакты", ["контакт", "знаком"]],
  ];

  const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const PERIODS = [
    { key: "week", days: 7, title: "Неделя" },
    { key: "two_weeks", days: 14, title: "2 недели" },
    { key: "month", days: 30, title: "Месяц" },
    { key: "quarter", days: 90, title: "Квартал" },
  ];
  const SKIP_TEXT = {
    yes: 1, no: 1, unsure: 1, skip: 1, want: 1, must: 1, guilt: 1,
    satisfied: 1, overspent: 1, sometimes: 1,
  };

  function nextQuestion(questions, answers) {
    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i];
      if (Object.prototype.hasOwnProperty.call(answers, question.key)) continue;
      if (question.onlyIf && !question.onlyIf(answers)) continue;
      return question;
    }
    return null;
  }

  function optionLabel(question, value) {
    const found = (question.options || []).filter(function (option) { return option.value === value; })[0];
    return found ? found.label : value;
  }

  function joinBits(bits) {
    if (!bits.length) return "";
    if (bits.length === 1) return bits[0];
    return bits.slice(0, -1).join(", ") + ", и " + bits[bits.length - 1];
  }

  function recommend(kind, answers) {
    const code = codeFor(kind, answers);
    const text = bodyFor(kind, code, answers);
    return {
      code: code,
      title: TITLES[code],
      body: text.body,
      phrase: text.phrase,
    };
  }

  function codeFor(kind, answers) {
    if (kind === "work") return workCode(answers);
    if (kind === "family") return familyCode(answers);
    return friendCode(answers);
  }

  function workCode(answers) {
    const related = answers.related === "yes";
    const want = answers.want === "yes";
    const more = answers.more_important === "yes";
    if (related && want && !more) return "go";
    if (!want && (!related || more)) return "decline";
    return "postpone";
  }

  function familyCode(answers) {
    const want = answers.want === "yes";
    const resources = answers.resources === "yes";
    const responsibility = answers.responsibility === "yes";
    const harm = answers.harm === "yes";
    if (!want && !resources) return responsibility || harm ? "postpone" : "decline";
    if (want && resources) return "go";
    return "postpone";
  }

  function friendCode(answers) {
    const want = answers.want === "yes";
    const energy = answers.energy === "yes";
    const motive = answers.motive;
    const wouldGo = answers.would_go === "yes";
    if (motive === "want" && want && energy) return "go";
    if (!want && motive === "guilt") return "decline";
    if (!want && !wouldGo) return "decline";
    if (!want && !energy) return "decline";
    return "postpone";
  }

  function bodyFor(kind, code, answers) {
    if (kind === "work") return workBody(code, answers);
    if (kind === "family") return familyBody(code, answers);
    return friendBody(code, answers);
  }

  function onlyNothing(value) {
    const parts = String(value || "").split(",").map(function (part) { return part.trim(); }).filter(Boolean);
    return parts.length > 0 && parts.every(function (part) { return part === "Ничего особенного"; });
  }

  function workBody(code, answers) {
    if (code === "go") {
      let body = "Это мероприятие выглядит значимым: оно связано с целями, и туда хочется. Можно идти — и сразу учесть, сколько времени и сил оно заберёт.";
      if (onlyNothing(answers.gain)) {
        body += " При этом отдача выглядит слабой. Если так и есть, отказаться тоже можно.";
      }
      return { body: body, phrase: "" };
    }
    if (code === "decline") {
      const bits = [];
      if (answers.related === "no") bits.push("это не про твои цели");
      if (answers.want === "no") bits.push("идти не хочется");
      if (answers.more_important === "yes") bits.push("на неделе есть более важное");
      return {
        body: "Возможно, сейчас это не стоит делать: " + (joinBits(bits) || "ключевые ответы скорее против") + ". Можно вежливо отказаться или предложить встретиться в другой раз.",
        phrase: "Спасибо за приглашение. Сейчас не смогу, давай в другой раз.",
      };
    }
    let body;
    if (answers.want === "no" && answers.obligation === "yes") {
      body = "Нужно обдумать: желание спорит с чувством, что ты должен согласиться. Можно не отвечать сразу и договориться о другом времени.";
    } else if (answers.want === "yes" && answers.related === "no") {
      body = "Тебе хочется пойти, но к твоим целям это почти не относится. Если сомневаешься — лучше другое время, чем автоматическое «да».";
    } else if (answers.more_important === "yes") {
      body = "Идти может быть полезно, но есть дела важнее. Лучше договориться о другом времени, чем втискивать ещё одну встречу.";
    } else {
      body = "Сигналы смешанные. Не спеши соглашаться — иногда честнее предложить другой день.";
    }
    return { body: body, phrase: "Спасибо за приглашение. Давай в другой раз, если будет уместно." };
  }

  function familyBody(code, answers) {
    const responsibility = answers.responsibility === "yes";
    const harm = answers.harm === "yes";
    const want = answers.want === "yes";
    const resources = answers.resources === "yes";
    const boundary = "Отказ от одной встречи не разрушит семью, если спокойно объяснить, что происходит.";
    if (code === "go" && responsibility) {
      return {
        body: "Похоже, твоя помощь нужна. Можно согласиться и сразу обозначить лимит по времени. Даже соглашаясь, оставь границу: сколько времени на это есть.",
        phrase: "",
      };
    }
    if (code === "go") {
      return {
        body: "Это скорее личное решение. Раз хочется и силы есть — можно идти, но свои границы всё равно при тебе.",
        phrase: "",
      };
    }
    if (code === "decline") {
      return {
        body: "Возможно, лучше отказать или перенести встречу, чтобы не перерасходовать силы. " + boundary,
        phrase: "Я сейчас не вывезу по времени. Давай в другой день — мне важно, просто ресурс на нуле.",
      };
    }
    let body;
    if (!want && !resources && (responsibility || harm)) {
      body = "Сейчас нет ни желания, ни ресурса. Даже если для семьи это важно, лучше перенести, чем соглашаться из последних сил.";
    } else if (!resources) {
      body = "Сил или времени сейчас мало. Честнее перенести, чем прийти без сил и потом выгорать.";
    } else if (!want) {
      body = "Желания сейчас нет. Можно не отказывать насовсем, а предложить другой день и ограничить время.";
    } else {
      body = "Можно предложить другой день: так остаются и отношения, и силы.";
    }
    return { body: body + " " + boundary, phrase: "Давай перенесём. Мне важно, просто сейчас нет ресурса." };
  }

  function friendBody(code, answers) {
    const comfort = "Хорошие друзья поймут, если тебе сейчас тяжело. Разовый отказ не разрушит отношения.";
    if (code === "go") {
      return { body: "Можно идти: этого хочется, и на встречу есть ресурс. Это полезно и приятно.", phrase: "" };
    }
    if (code === "decline") {
      return { body: "Можно вежливо отказаться. " + comfort, phrase: "Я не смогу, давай в другой раз." };
    }
    const body = answers.want === "yes" && answers.energy === "no"
      ? "Встреча нравится, но сил сейчас мало. Подумай: можно предложить альтернативу — короче или в другой день."
      : "Подумай: можно предложить альтернативу — встретиться короче или в более удобный день.";
    return { body: body + " " + comfort, phrase: "Я не смогу, давай в другой раз." };
  }

  function signalTags(kind, answers) {
    const tags = [];
    function add(flag, tag) { if (flag) tags.push(tag); }
    if (kind === "work") {
      add(answers.related === "no", "not_goals");
      add(answers.want === "no", "no_desire");
      add(answers.obligation === "yes", "obligation");
      add(answers.more_important === "yes", "more_important");
    } else if (kind === "family") {
      add(answers.want === "no", "no_desire");
      add(answers.resources === "no", "no_energy");
      add(answers.responsibility === "yes", "duty");
      add(answers.harm === "yes", "relation_risk");
    } else if (kind === "friend") {
      add(answers.want === "no", "no_desire");
      add(answers.energy === "no", "no_energy");
      add(answers.motive === "guilt", "guilt");
      add(answers.motive === "must", "obligation");
      add(answers.would_go === "no", "would_not_go");
    }
    return tags;
  }

  function parseHours(value) {
    if (value === null || value === undefined || value === "" || value === "skip") return null;
    const number = Number(String(value).replace(",", "."));
    if (!isFinite(number) || number < 0 || number > 168) return null;
    return number;
  }

  function formatHours(value) {
    if (Math.abs(value - Math.round(value)) < 1e-9) return Math.round(value) + " ч";
    if (Math.abs(value - 0.5) < 1e-9) return "30 мин";
    return String(Math.round(value * 10) / 10).replace(".", ",") + " ч";
  }

  function meetingsGenitive(count) {
    const number = Math.abs(count);
    const word = number % 10 === 1 && number % 100 !== 11 ? "встречи" : "встреч";
    return number + " " + word;
  }

  function summarize(events, goals, periodKey, now) {
    const period = PERIODS.filter(function (item) { return item.key === periodKey; })[0] || PERIODS[0];
    const start = new Date(now.getTime() - period.days * 86400000);
    const chosen = events.filter(function (event) { return new Date(event.createdAt) >= start; });
    const range = formatRange(start, now);
    if (!chosen.length) {
      return {
        title: period.title,
        range: range,
        empty: "За эти дни фильтр ещё не использовался. Разбери одно приглашение — и здесь появится первая сводка.",
        periods: PERIODS,
      };
    }
    const declined = chosen.filter(function (event) { return event.decision === "declined"; });
    const hoursSaved = sum(declined.map(function (event) { return parseHours(event.answers.hours); }));
    const work = chosen.filter(function (event) { return event.kind === "work"; });
    const aligned = work.filter(function (event) { return event.answers.related === "yes"; });
    return {
      title: period.title,
      range: range,
      empty: "",
      periods: PERIODS,
      progress: progressLine(declined.length, hoursSaved, chosen.length, aligned.length, work.length),
      total: chosen.length,
      kinds: ["work", "family", "friend"].map(function (kind) {
        return { kind: kind, label: KIND_META[kind].label, count: chosen.filter(function (event) { return event.kind === kind; }).length };
      }).filter(function (item) { return item.count; }),
      recommendations: countRows(chosen, "recommendation", [
        ["go", "Идти"], ["decline", "Отказаться"], ["postpone", "Перенести"],
      ]),
      decisions: countRows(chosen.filter(function (event) { return event.decision; }), "decision", [
        ["planned", "Запланировано"], ["declined", "Отказ"], ["postponed", "Перенос"],
      ]),
      unmarked: chosen.filter(function (event) { return !event.decision; }).length,
      reasons: reasonRows(declined),
      relationRisk: declined.filter(function (event) {
        return (event.reasonTags || []).indexOf("relation_risk") !== -1;
      }).length,
      feedback: feedbackBlock(chosen.filter(function (event) { return event.feedback; })),
      time: timeBlock(chosen, hoursSaved),
      goalsMatch: work.length ? { aligned: aligned.length, total: work.length } : null,
      guilt: guiltBlock(declined),
      themes: themeCounts(chosen),
      goals: goals,
    };
  }

  function progressLine(declined, hoursSaved, total, aligned, workTotal) {
    if (!total) return "";
    const parts = [];
    if (declined && hoursSaved) {
      parts.push("Удалось отказаться от " + meetingsGenitive(declined) + " — это около " + formatHours(hoursSaved) + " свободнее.");
    } else if (declined) {
      parts.push("Удалось отказаться от " + meetingsGenitive(declined) + ".");
    }
    if (workTotal >= 3 && aligned / workTotal >= 0.6) parts.push("Рабочие ситуации чаще совпадают с целями.");
    else if (workTotal >= 3 && aligned / workTotal <= 0.3) parts.push("Много рабочих приглашений мимо целей — фильтр как раз про это.");
    if (!parts.length) parts.push("Приглашения разбираются до ответа. Так и устроен внутренний фильтр.");
    return parts.join(" ");
  }

  function countRows(events, field, rows) {
    const total = events.length || 1;
    return rows.map(function (row) {
      const count = events.filter(function (event) { return event[field] === row[0]; }).length;
      return { label: row[1], count: count, share: count / total };
    }).filter(function (row) { return row.count; });
  }

  function reasonRows(declined) {
    const counts = {};
    declined.forEach(function (event) {
      (event.reasonTags || []).forEach(function (tag) {
        if (REFUSAL_TAGS.indexOf(tag) === -1) return;
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return REFUSAL_TAGS.filter(function (tag) { return counts[tag]; }).map(function (tag) {
      return { label: TAG_LABELS[tag], count: counts[tag] };
    });
  }

  function feedbackBlock(events) {
    if (!events.length) return null;
    const satisfied = events.filter(function (event) { return event.feedback.satisfaction === "satisfied"; }).length;
    const overspent = events.filter(function (event) { return event.feedback.satisfaction === "overspent"; }).length;
    const unsure = events.filter(function (event) { return event.feedback.satisfaction === "unsure"; }).length;
    return {
      total: events.length,
      satisfied: satisfied,
      overspent: overspent,
      unsure: unsure,
      percent: Math.round(100 * satisfied / events.length),
      repeatYes: events.filter(function (event) { return event.feedback.repeat === "yes"; }).length,
      repeatNo: events.filter(function (event) { return event.feedback.repeat === "no"; }).length,
    };
  }

  function timeBlock(events, hoursSaved) {
    let spent = 0;
    let any = false;
    events.forEach(function (event) {
      if (event.decision !== "planned" || !event.feedback) return;
      let hours = parseHours(event.feedback.hours);
      if (hours === null) hours = parseHours(event.answers.hours);
      if (hours === null) return;
      spent += hours;
      any = true;
    });
    if (!any && !hoursSaved) return null;
    return {
      spent: any ? formatHours(spent) : "",
      saved: hoursSaved ? formatHours(hoursSaved) : "",
    };
  }

  function guiltBlock(declined) {
    const events = declined.filter(function (event) { return event.guilt; });
    if (!events.length) return null;
    const none = events.filter(function (event) { return event.guilt === "none"; }).length;
    const passed = events.filter(function (event) { return event.guilt === "passed"; }).length;
    const still = events.filter(function (event) { return event.guilt === "still"; }).length;
    return { none: none, passed: passed, still: still, calm: still === 0 && none + passed > 0 };
  }

  function themeCounts(events) {
    const counts = {};
    events.forEach(function (event) {
      const blob = textBlob(event);
      if (!blob) return;
      THEMES.forEach(function (theme) {
        const hit = theme[1].some(function (stem) { return blob.indexOf(stem) !== -1; });
        if (hit) counts[theme[0]] = (counts[theme[0]] || 0) + 1;
      });
    });
    return Object.keys(counts).map(function (name) {
      return { name: name, count: counts[name] };
    }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); }).slice(0, 4);
  }

  function textBlob(event) {
    const parts = [];
    [event.answers || {}, event.feedback || {}].forEach(function (source) {
      Object.keys(source).forEach(function (key) {
        const value = source[key];
        if (key === "hours" || typeof value !== "string" || SKIP_TEXT[value]) return;
        parts.push(value);
      });
    });
    return parts.join(" ").toLowerCase();
  }

  function formatRange(start, end) {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return start.getDate() + "–" + end.getDate() + " " + MONTHS[end.getMonth()];
    }
    if (start.getFullYear() === end.getFullYear()) {
      return start.getDate() + " " + MONTHS[start.getMonth()] + " – " + end.getDate() + " " + MONTHS[end.getMonth()];
    }
    return start.getDate() + " " + MONTHS[start.getMonth()] + " " + start.getFullYear() + " – " + end.getDate() + " " + MONTHS[end.getMonth()] + " " + end.getFullYear();
  }

  function sum(values) {
    return values.reduce(function (total, value) { return total + (value || 0); }, 0);
  }

  window.TimeFilter = {
    SCENARIOS: SCENARIOS,
    FEEDBACK: FEEDBACK,
    KIND_META: KIND_META,
    PERIODS: PERIODS,
    nextQuestion: nextQuestion,
    optionLabel: optionLabel,
    recommend: recommend,
    signalTags: signalTags,
    summarize: summarize,
  };
})();
