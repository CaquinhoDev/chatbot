const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const spin_text = (text) => {
    const pattern = /\{([^{}]+)\}/g;

    while (pattern.test(text)) {
      text = text.replace(pattern, (match, p1) => {
        const options = p1.split('|');
        const randomIndex = Math.floor(Math.random() * options.length);
        return options[randomIndex];
      });
    }

    return text;
};

module.exports = { spin_text, rl };