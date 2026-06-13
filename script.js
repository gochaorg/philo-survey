// Переменные для хранения данных и прогресса
let questionsData = [];
let graphStructure = {};
let userScores = {};
let maxScores = {};
let networkInstance = null; // Экземпляр графа vis.js

// 1. ПОДКЛЮЧЕНИЕ JSON К СКРИПТУ (Загрузка данных)
document.addEventListener("DOMContentLoaded", () => {
    // Асинхронно загружаем оба файла
    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('positions.json').then(res => res.json())
    ])
    .then(([questions, graph]) => {
        questionsData = questions;
        graphStructure = graph;

        calculateMaxScores();
        generateQuiz();
        
        // Восстанавливаем сохранённые ответы из localStorage
        loadFromLocalStorage();
    })
    .catch(err => console.error("Ошибка при загрузке конфигурационных файлов JSON:", err));
});

// Предварительный расчет максимальных баллов для каждой позиции
function calculateMaxScores() {
    questionsData.forEach(q => {
        q.options.forEach(opt => {
            for (let position in opt.effects) {
                // Инициализируем нулями
                if (!userScores[position]) userScores[position] = 0;
                
                // Суммируем только положительные веса для вычисления максимума шкал
                if (opt.effects[position] > 0) {
                    maxScores[position] = (maxScores[position] || 0) + opt.effects[position];
                }
            }
        });
    });
}

// 2. ГЕНЕРАЦИЯ ВОПРОСНИКА (Отрисовка HTML)
function generateQuiz() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = ''; // Очищаем контейнер

    questionsData.forEach((q, qIndex) => {
        // Создаем блок вопроса
        const questionBlock = document.createElement('div');
        questionBlock.className = 'question-block';
        questionBlock.style.marginBottom = '24px';

        // Текст вопроса
        const questionTitle = document.createElement('p');
        questionTitle.innerHTML = `<strong>Вопрос ${qIndex + 1}:</strong> ${q.text}`;
        questionBlock.appendChild(questionTitle);

        // Генерация вариантов ответов (радиокнопки)
        q.options.forEach((opt, optIndex) => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '8px';
            label.style.cursor = 'pointer';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = q.id; // Группировка кнопок по ID вопроса
            radio.style.marginRight = '8px';
            
            // Записываем индексы в атрибуты, чтобы потом легко извлечь эффекты
            radio.dataset.qIndex = qIndex;
            radio.dataset.optIndex = optIndex;
            radio.required = true;

            // Слушатель для автосохранения в localStorage
            radio.addEventListener('change', saveToLocalStorage);

            label.appendChild(radio);
            label.appendChild(document.createTextNode(opt.text));
            questionBlock.appendChild(label);
        });

        container.appendChild(questionBlock);
    });
}

// 3. ПОДСЧЕТ ОТВЕТОВ И ВЫЧИСЛЕНИЕ РЕЗУЛЬТАТОВ
function calculateResults(event) {
    event.preventDefault(); // Предотвращаем перезагрузку страницы формой

    // Сбрасываем старые баллы пользователя перед новым подсчетом
    for (let position in userScores) {
        userScores[position] = 0;
    }

    // Ищем все выбранные радиокнопки
    const selectedRadios = document.querySelectorAll('input[type="radio"]:checked');
    
    // Проверка: ответил ли пользователь на все вопросы
    if (selectedRadios.length < questionsData.length) {
        alert("Пожалуйста, ответьте на все вопросы теста перед отправкой.");
        return;
    }

    // Начисляем баллы на основе выбранных опций
    selectedRadios.forEach(radio => {
        const qIdx = radio.dataset.qIndex;
        const optIdx = radio.dataset.optIndex;
        const effects = questionsData[qIdx].options[optIdx].effects;

        for (let position in effects) {
            userScores[position] += effects[position];
        }
    });

    // Выводим результаты на экран
    displayResults();

    // Показываем блок результатов и запускаем отрисовку графа
    document.getElementById('results-area').style.display = 'block';
    drawGraph();
    document.getElementById('results-area').scrollIntoView({ behavior: 'smooth' });
}

// Рендеринг итоговых процентов соответствия позициям
function displayResults() {
    const resultsContainer = document.getElementById('position-values');
    resultsContainer.innerHTML = '<h2>Ваш философский профиль:</h2>';

    for (let position in userScores) {
        let max = maxScores[position] || 1;
        // Переводим в проценты и ограничиваем диапазон от 0 до 100
        let pct = (userScores[position] / max) * 100;
        pct = Math.max(0, Math.min(100, pct));
        pct = Math.round(pct);

        // Добавляем строку с результатом на страницу
        const resultLine = document.createElement('p');

        let ppos = graphStructure.nodes.find( n => n.id == position );
        if( ppos ){
          let fg = '#c80101';
          if( pct < 10 ){
            fg = '#e28b00';
          } else if ( pct < 25 ){
            fg = '#dac503';
          } else if ( pct < 50 ){
            fg = '#a4d603';
          } else if ( pct < 75 ){
            fg = '#199001';
          } else {
          }

          resultLine.innerHTML = 
            `<strong style="color: ${fg}">${position}:</strong> ${pct}% совпадения
              <br/> Секция: ${ppos.section}
              <br/> Направление: ${ppos.label}
              Описание: 
              <br/> ${ppos.desc}              
            `;
        }else{
          resultLine.innerHTML = 
            `<strong>${position}:</strong> 
              ${pct}% совпадения
            `;
        }

        resultsContainer.appendChild(resultLine);
    }
    
    // Прокрутка экрана к результатам
    //resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// ВИЗУАЛИЗАЦИЯ: Отрисовка графа на основе Vis.js
function drawGraph() {
    const container = document.getElementById('network-container');
    
    // 1. Превращаем вершины (nodes) из positions.json в формат Vis.js
    const visNodes = graphStructure.nodes.map(node => {
        let max = maxScores[node.id] || 1;
        let pct = (userScores[node.id] / max) * 100;
        pct = Math.max(0, Math.min(100, pct));
        pct = Math.round(pct);

        // --- Пороговые значения для размера ---
        let nodeSize;
        if (pct < 10)       nodeSize = 20;
        else if (pct < 25)  nodeSize = 25;
        else if (pct < 50)  nodeSize = 32;
        else if (pct < 75)  nodeSize = 42;
        else                nodeSize = 52;

        // --- Пороговые значения для цветов (фон, обводка, шрифт) ---
        let bgColor, borderColor, fontColor;
        if (pct < 10) {
            bgColor     = '#f5f5f5';   // почти белый
            borderColor = '#bdbdbd';
            fontColor   = '#757575';
        } else if (pct < 25) {
            bgColor     = '#ffcdd2';   // светло-красный
            borderColor = '#ef9a9a';
            fontColor   = '#be3d3d';
        } else if (pct < 50) {
            bgColor     = '#fff9c4';   // светло-жёлтый
            borderColor = '#fff176';
            fontColor   = '#dd883d';
        } else if (pct < 75) {
            bgColor     = '#c8e6c9';   // светло-зелёный
            borderColor = '#81c784';
            fontColor   = '#238255';
        } else {
            bgColor     = '#2e7d32';   // насыщенный зелёный
            borderColor = '#1b5e20';
            fontColor   = '#113e19';
        }

        return {
            id: node.id,
            label: `${node.label}\n(${pct}%)`,
            title: node.desc,
            size: nodeSize,
            shape: 'dot',
            color: {
                background: bgColor,
                border: borderColor,
                highlight: { background: '#2196f3', border: '#0b7dda' }
            },
            font: {
                color: fontColor,
                size: 14,
                strokeWidth: 0.5,
                strokeColor: (pct >= 75) ? 'transparent' : '#eeeeee'
            }
        };
    });

    // 2. Превращаем связи (links) в ребра Vis.js (edges)
    const visEdges = graphStructure.links.map(link => {
        const isContradictory = link.weight < 0;
        // ИСПРАВЛЕНИЕ: Увеличили непрозрачность (с 0.25 до 0.55), чтобы линии были четко видны
        const edgeColor = isContradictory ? 'rgba(244, 67, 54, 0.55)' : 'rgba(76, 175, 80, 0.55)';
        
        return {
            from: link.source,
            to: link.target,
            color: edgeColor,
            // ИСПРАВЛЕНИЕ: Сделали базовую толщину 3 пикселя + добавочный вес от силы связи
            width: 3 + (Math.abs(link.weight) * 3), 
            title: link.note || '' 
        };
    });

    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };

    // 3. Настройки физики и отображения графа
    const options = {
        nodes: {
            borderWidth: 2
        },
        edges: {
            smooth: {
                type: 'continuous' // Сглаженные изогнутые линии связей
            }
        },
        physics: {
            barnesHut: {
                gravitationalConstant: -5500, // Чуть сильнее расталкиваем узлы, чтобы текст не накладывался
                centralGravity: 0.2,
                springLength: 200, 
                springConstant: 0.04
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200
        }
    };

    // Если граф уже перерисовывался, уничтожаем старый объект
    if (networkInstance !== null) {
        networkInstance.destroy();
    }

    // Инициализация холста графа
    networkInstance = new vis.Network(container, data, options);
}

// =====================================================
// 4. СБОР РЕЗУЛЬТАТОВ И ВЫБРАННЫХ ВАРИАНТОВ
// =====================================================

// Собирает все выбранные ответы в структурированный массив
function collectSelectedAnswers() {
    const selectedRadios = document.querySelectorAll('input[type="radio"]:checked');
    const answers = [];

    selectedRadios.forEach(radio => {
        const qIdx = parseInt(radio.dataset.qIndex);
        const optIdx = parseInt(radio.dataset.optIndex);
        const question = questionsData[qIdx];
        const option = question.options[optIdx];

        answers.push({
            questionId: question.id,
            questionIndex: qIdx,
            questionText: question.text,
            optionIndex: optIdx,
            optionText: option.text,
            effects: option.effects
        });
    });

    return answers;
}

// Собирает полные результаты: выбранные ответы + итоговые баллы
function collectFullResults() {
    const answers = collectSelectedAnswers();
    
    // Считаем баллы
    const scores = {};
    const percentages = {};
    
    for (let position in maxScores) {
        scores[position] = 0;
    }
    
    answers.forEach(ans => {
        for (let position in ans.effects) {
            scores[position] = (scores[position] || 0) + ans.effects[position];
        }
    });

    for (let position in scores) {
        let max = maxScores[position] || 1;
        let pct = (scores[position] / max) * 100;
        percentages[position] = Math.max(0, Math.min(100, Math.round(pct)));
    }

    return {
        timestamp: new Date().toISOString(),
        answers: answers,
        scores: scores,
        percentages: percentages
    };
}

// =====================================================
// 5. LOCALSTORAGE: СОХРАНЕНИЕ И ЗАГРУЗКА
// =====================================================

// Сохраняет выбранные ответы в localStorage
function saveToLocalStorage() {
    const answers = collectSelectedAnswers();
    const dataToSave = {
        savedAt: new Date().toISOString(),
        answers: answers
    };
    
    try {
        localStorage.setItem('quiz-answers', JSON.stringify(dataToSave));
    } catch (e) {
        console.warn("Не удалось сохранить в localStorage:", e);
    }
}

// Загружает сохранённые ответы из localStorage и восстанавливает выбор
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('quiz-answers');
        if (!savedData) return;

        const parsed = JSON.parse(savedData);
        if (!parsed.answers || !Array.isArray(parsed.answers)) return;

        // Восстанавливаем каждый ответ
        parsed.answers.forEach(savedAnswer => {
            const qIdx = savedAnswer.questionIndex;
            const optIdx = savedAnswer.optionIndex;

            // Находим соответствующую радиокнопку
            const question = questionsData[qIdx];
            if (!question) return;

            const radio = document.querySelector(
                `input[type="radio"][name="${question.id}"][data-q-index="${qIdx}"][data-opt-index="${optIdx}"]`
            );
            
            if (radio) {
                radio.checked = true;
            }
        });

        console.log(`Восстановлено ${parsed.answers.length} ответов из localStorage (сохранено: ${parsed.savedAt})`);
    } catch (e) {
        console.warn("Не удалось загрузить из localStorage:", e);
    }
}

// Очищает сохранённые данные
function clearLocalStorage() {
    if (confirm("Вы уверены, что хотите очистить все сохранённые ответы?")) {
        localStorage.removeItem('quiz-answers');
        // Снимаем все галочки
        document.querySelectorAll('input[type="radio"]:checked').forEach(r => r.checked = false);
        alert("Сохранённые ответы удалены.");
    }
}

// =====================================================
// 6. ЭКСПОРТ И ИМПОРТ JSON
// =====================================================

// Экспорт: скачивание файла с результатами
function exportResults() {
    const results = collectFullResults();
    const jsonStr = JSON.stringify(results, null, 2);
    
    // Создаём Blob и ссылку для скачивания
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    // Имя файла с датой
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `quiz-results-${dateStr}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Экспорт: скачивание только выбранных ответов (без подсчёта баллов)
function exportAnswers() {
    const data = {
        timestamp: new Date().toISOString(),
        answers: collectSelectedAnswers()
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `quiz-answers-${dateStr}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Импорт: загрузка JSON-файла с ответами
function importResults() {
    // Создаём скрытый input для выбора файла
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                // Проверяем структуру
                if (!imported.answers || !Array.isArray(imported.answers)) {
                    alert("Ошибка: файл не содержит корректных данных ответов.");
                    return;
                }

                // Снимаем все текущие галочки
                document.querySelectorAll('input[type="radio"]:checked').forEach(r => r.checked = false);

                // Восстанавливаем ответы из файла
                let restoredCount = 0;
                imported.answers.forEach(savedAnswer => {
                    const qIdx = savedAnswer.questionIndex;
                    const optIdx = savedAnswer.optionIndex;

                    const question = questionsData[qIdx];
                    if (!question) return;

                    const radio = document.querySelector(
                        `input[type="radio"][name="${question.id}"][data-q-index="${qIdx}"][data-opt-index="${optIdx}"]`
                    );
                    
                    if (radio) {
                        radio.checked = true;
                        restoredCount++;
                    }
                });

                // Сохраняем импортированные данные в localStorage
                saveToLocalStorage();

                alert(`Импортировано ${restoredCount} из ${imported.answers.length} ответов.\nФайл от: ${imported.timestamp || 'неизвестно'}`);

            } catch (err) {
                alert("Ошибка при чтении JSON-файла: " + err.message);
            }
        };
        
        reader.readAsText(file);
    });

    // Программно кликаем на input, чтобы открыть диалог выбора файла
    fileInput.click();
}

// =====================================================
// 7. ИНИЦИАЛИЗАЦИЯ КНОПОК УПРАВЛЕНИЯ
// =====================================================

// Добавляем кнопки управления в DOM после загрузки страницы
document.addEventListener("DOMContentLoaded", () => {
    // Ждём, пока quiz-container будет готов
    const checkInterval = setInterval(() => {
        const container = document.getElementById('quiz-container');
        if (container && questionsData.length > 0) {
            clearInterval(checkInterval);
            createControlButtons();
        }
    }, 100);
});

function createControlButtons() {
    // Создаём панель управления
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    controlPanel.style.cssText = 'margin: 20px 0; padding: 16px; background: #f0f0f0; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;';
    
    controlPanel.innerHTML = `
        <strong style="margin-right: 10px;">Управление данными:</strong>
        <button onclick="saveToLocalStorage(); alert('Сохранено в браузере!');" 
                style="padding: 8px 16px; cursor: pointer; background: #2196f3; color: white; border: none; border-radius: 4px;">
            💾 Сохранить в браузере
        </button>
        <button onclick="clearLocalStorage()" 
                style="padding: 8px 16px; cursor: pointer; background: #ff9800; color: white; border: none; border-radius: 4px;">
            🗑️ Очистить сохранённое
        </button>
        <button onclick="exportResults()" 
                style="padding: 8px 16px; cursor: pointer; background: #4caf50; color: white; border: none; border-radius: 4px;">
            📥 Экспорт результатов (JSON)
        </button>
        <button onclick="exportAnswers()" 
                style="padding: 8px 16px; cursor: pointer; background: #8bc34a; color: white; border: none; border-radius: 4px;">
            📥 Экспорт ответов (JSON)
        </button>
        <button onclick="importResults()" 
                style="padding: 8px 16px; cursor: pointer; background: #9c27b0; color: white; border: none; border-radius: 4px;">
            📤 Импорт из JSON
        </button>
    `;

    const controlPanelContainer = document.getElementById('controlPanel');
    controlPanelContainer.appendChild(controlPanel);
}

// Привязываем функцию подсчета к отправке формы
document.getElementById('quiz-form').addEventListener('submit', calculateResults);