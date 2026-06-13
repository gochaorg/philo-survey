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
    //displayResults();

    // Показываем блок результатов и запускаем отрисовку графа
    document.getElementById('results-area').style.display = 'block';
    drawGraph();
    document.getElementById('results-area').scrollIntoView({ behavior: 'smooth' });
}

// Рендеринг итоговых процентов соответствия позициям
function displayResults() {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '<h2>Ваш философский профиль:</h2>';

    for (let position in userScores) {
        let max = maxScores[position] || 1;
        // Переводим в проценты и ограничиваем диапазон от 0 до 100
        let pct = (userScores[position] / max) * 100;
        pct = Math.max(0, Math.min(100, pct));
        pct = Math.round(pct);

        // Добавляем строку с результатом на страницу
        const resultLine = document.createElement('p');
        resultLine.innerHTML = `<strong>${position}:</strong> ${pct}% совпадения`;
        resultsContainer.appendChild(resultLine);
    }
    
    // Прокрутка экрана к результатам
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
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

        // Динамический размер узла зависит от набранного процента согласия респондента
        // Базовый размер 15 (если 0%), максимальный — 45 (при 100% совпадении)
        const nodeSize = 15 + (pct * 0.3);

        // Стилизация узла: если респондент склонен к позиции (>50%), красим в зеленый
        const isBeliever = pct >= 50;
        const nodeColor = isBeliever ? '#4caf50' : '#cfd8dc';
        const fontColor = isBeliever ? '#ffffff' : '#37474f';

        return {
            id: node.id,
            label: `${node.label}\n(${pct}%)`,
            title: node.desc, // Всплывающая подсказка при наведении
            size: nodeSize,
            shape: 'dot',
            color: {
                background: nodeColor,
                border: isBeliever ? '#388e3c' : '#b0bec5',
                highlight: { background: '#2196f3', border: '#0b7dda' }
            },
            font: { color: fontColor, size: 14, strokeWidth: 2, strokeColor: '#ffffff' }
        };
    });

    // 2. Превращаем связи (links) в ребра Vis.js (edges)
    const visEdges = graphStructure.links.map(link => {
        // Подсвечиваем типы связей: зеленый для совместимости, красный для противоречий
        const isContradictory = link.weight < 0;
        const edgeColor = isContradictory ? 'rgba(244, 67, 54, 0.25)' : 'rgba(76, 175, 80, 0.25)';
        
        return {
            from: link.source,
            to: link.target,
            color: edgeColor,
            width: Math.abs(link.weight) * 2, // Толщина ребра зависит от силы связи
            title: link.note || '' // Текст связи при наведении
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
                gravitationalConstant: -3000, // Сила отталкивания узлов друг от друга
                centralGravity: 0.3,
                springLength: 150, // Длина связей
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

// Привязываем функцию подсчета к отправке формы
document.getElementById('quiz-form').addEventListener('submit', calculateResults);
