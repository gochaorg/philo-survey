// Переменные для хранения данных и прогресса
let questionsData = [];
let userScores = {};
let maxScores = {}

// 1. ПОДКЛЮЧЕНИЕ JSON К СКРИПТУ (Загрузка данных)
document.addEventListener("DOMContentLoaded", () => {
    fetch('questions.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("Не удалось загрузить questions.json");
            }
            return response.json();
        })
        .then(data => {
            questionsData = data;
            calculateMaxScores(); // Считаем потенциальный максимум для процентов
            generateQuiz();       // Рендерим вопросы на странице
        })
        .catch(error => console.error("Ошибка инициализации теста:", error));
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
    displayResults();
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

// Привязываем функцию подсчета к отправке формы
document.getElementById('quiz-form').addEventListener('submit', calculateResults);
