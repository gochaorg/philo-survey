// Ждем загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('btn');
    const output = document.getElementById('output');

    // Обрабатываем клик по кнопке
    button.addEventListener('click', () => {
        const time = new Date().toLocaleTimeString();
        output.innerText = `JS работает прямо в браузере! Время клика: ${time}`;
    });
});
