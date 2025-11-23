import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));

class MinesweeperGame {
    constructor(rows = 9, cols = 9, mines = 10) {
        this.rows = rows;
        this.cols = cols;
        this.mines = mines;
        this.board = Array(rows).fill().map(() => Array(cols).fill(0)); 
        this.revealed = Array(rows).fill().map(() => Array(cols).fill(false));
        this.flagged = Array(rows).fill().map(() => Array(cols).fill(false));
        this.gameOver = false;
        this.won = false;
        this.firstMove = true;
        this.placeMines();
        this.calculateNumbers();
    }

    placeMines() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        let placed = 0;
        while (placed < this.mines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (this.board[r][c] !== -1) {
                this.board[r][c] = -1;
                placed++;
            }
        }
    }

    calculateNumbers() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] === -1) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc] === -1) count++;
                    }
                }
                this.board[r][c] = count;
            }
        }
    }

    reveal(r, c) {
        if (this.gameOver || this.revealed[r][c] || this.flagged[r][c]) return;
        
        if (this.firstMove) {
            if (this.board[r][c] === -1) {
                this.placeMines();
                while(this.board[r][c] === -1) {
                    this.placeMines();
                }
                this.calculateNumbers();
            }
            this.firstMove = false;
        }

        this.revealed[r][c] = true;

        if (this.board[r][c] === -1) {
            this.gameOver = true;
            this.won = false;
            return;
        }

        if (this.board[r][c] === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        this.reveal(nr, nc);
                    }
                }
            }
        }
        this.checkWin();
    }

    flag(r, c) {
        if (this.gameOver || this.revealed[r][c]) return;
        this.flagged[r][c] = !this.flagged[r][c];
    }

    checkWin() {
        let revealedCount = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.revealed[r][c]) revealedCount++;
            }
        }
        if (revealedCount === this.rows * this.cols - this.mines) {
            this.won = true;
            this.gameOver = true;
        }
    }
}

const generateBoardImage = async (game) => {
    const cellSize = 50;
    const headerSize = 40; 
    const padding = 10;
    const width = game.cols * cellSize + headerSize + padding;
    const height = game.rows * cellSize + headerSize + padding;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const hiddenColor = '#BDBDBD';
    const revealedColor = '#E0E0E0';
    const mineColor = '#FF5252';
    const flagColor = '#FFD740';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for(let c = 0; c < game.cols; c++) {
        const letter = String.fromCharCode(97 + c);
        ctx.fillText(letter, headerSize + c * cellSize + cellSize/2, headerSize/2);
    }
    for(let r = 0; r < game.rows; r++) {
        ctx.fillText((r + 1).toString(), headerSize/2, headerSize + r * cellSize + cellSize/2);
    }

    const numberColors = [null, '#1976D2', '#388E3C', '#D32F2F', '#7B1FA2', '#FF8F00', '#0097A7', '#424242', '#000000'];

    for (let r = 0; r < game.rows; r++) {
        for (let c = 0; c < game.cols; c++) {
            const x = headerSize + c * cellSize;
            const y = headerSize + r * cellSize;

            let isRevealed = game.revealed[r][c];
            let isFlagged = game.flagged[r][c];
            let content = game.board[r][c];

            if (game.gameOver && content === -1) {
                isRevealed = true; 
            }

            if (isFlagged && !isRevealed) {
                ctx.fillStyle = flagColor;
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.fillStyle = '#000000';
                ctx.fillText('🚩', x + cellSize / 2, y + cellSize / 2);
            } else if (!isRevealed) {
                ctx.fillStyle = hiddenColor;
                ctx.fillRect(x, y, cellSize, cellSize);

                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(x, y, cellSize, 4); 
                ctx.fillRect(x, y, 4, cellSize); 
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(x + cellSize - 4, y, 4, cellSize);
                ctx.fillRect(x, y + cellSize - 4, cellSize, 4);

            } else {
                if (content === -1) {
                    ctx.fillStyle = mineColor;
                    ctx.fillRect(x, y, cellSize, cellSize);
                    ctx.fillStyle = '#000000';
                    ctx.fillText('💣', x + cellSize / 2, y + cellSize / 2);
                } else {
                    ctx.fillStyle = revealedColor;
                    ctx.fillRect(x, y, cellSize, cellSize);
                    if (content > 0) {
                        ctx.fillStyle = numberColors[content] || '#000000';
                        ctx.font = 'bold 24px Arial';
                        ctx.fillText(content.toString(), x + cellSize / 2, y + cellSize / 2);
                    }
                }
            }

            ctx.strokeStyle = '#757575';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellSize, cellSize);
        }
    }

    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const imagePath = path.join(cacheDir, `ms_${Date.now()}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);
    return imagePath;
};

const parseCoord = (coord, rows, cols) => {
    if (coord.length < 2) return null;
    const col = coord.charCodeAt(0) - 97;
    const row = parseInt(coord.slice(1)) - 1; 
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { row, col };
};

export default {
    config: {
        name: "minesweeper",
        cooldown: 5,
        aliases: ["ms", "mine"],
        description: "Play Minesweeper",
        category: "games",
        usage: `${global.client.config.PREFIX}minesweeper`
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;
        const senderId = event.key.participant || event.key.remoteJid;

        const game = new MinesweeperGame();

        const imagePath = await generateBoardImage(game);
        if (!imagePath) {
            return await sock.sendMessage(chatId, { text: "Failed to generate board." }, { quoted: event });
        }

        const sentMessage = await sock.sendMessage(chatId, {
            image: { url: imagePath },
            caption: `💣 Minesweeper Started!\n\nUser: @${senderId.split('@')[0]}\n\n• Reply "a1" to reveal\n• Reply "flag a1" to flag\n• Grid: 9x9 | Mines: 10`,
            mentions: [senderId]
        }, { quoted: event });

        global.client.replies.set(sentMessage.key.id, {
            commandName: "minesweeper",
            game: game,
            player: senderId,
            mid: sentMessage
        });

        fs.unlink(imagePath, (err) => { if (err) console.error(err); });
    },

    onReply: async ({ sock, event, args, data, threadID, senderID, message }) => {
        const { game, player, mid } = data;
        const chatId = threadID;
        const replyText = event.message?.conversation || event.message?.extendedTextMessage?.text || '';

        if (player !== senderID) {
            return await sock.sendMessage(chatId, { text: "Not your game!" }, { quoted: event });
        }

        if (game.gameOver) {
            return await sock.sendMessage(chatId, { text: "Game is already over." }, { quoted: event });
        }

        const parts = replyText.trim().toLowerCase().split(/\s+/);
        let coord, action = 'reveal';
        
        if (parts[0] === 'flag' && parts.length === 2) {
            action = 'flag';
            coord = parts[1];
        } else if (parts.length === 1) {
            coord = parts[0];
        } else {
            return await sock.sendMessage(chatId, { text: "Invalid format. Use 'a1' or 'flag a1'" }, { quoted: event });
        }

        const pos = parseCoord(coord, game.rows, game.cols);
        if (!pos) {
            return await sock.sendMessage(chatId, { text: "Invalid coordinate. Range: a1 - i9" }, { quoted: event });
        }

        if (action === 'reveal') {
            game.reveal(pos.row, pos.col);
        } else {
            game.flag(pos.row, pos.col);
        }

        let caption = `💣 Minesweeper\n\n`;
        if (game.gameOver) {
            caption += game.won ? "🏆 VICTORY! You found all mines!" : "💥 BOOM! You hit a mine!";
        } else {
            caption += "Reply with coordinate (e.g., c4) or 'flag c4'";
        }

        const imagePath = await generateBoardImage(game);
        if (!imagePath) {
            return await sock.sendMessage(chatId, { text: "Error generating board." }, { quoted: event });
        }

        const sentMessage = await sock.sendMessage(chatId, {
            image: { url: imagePath },
            caption: caption
        }, { quoted: event });

        try {
            if (mid) await message.unsend(mid);
        } catch (e) {
            // ignore
        }

        if (!game.gameOver) {
            global.client.replies.set(sentMessage.key.id, {
                commandName: "minesweeper",
                game: game,
                player: player,
                mid: sentMessage
            });
        }

        fs.unlink(imagePath, (err) => { if (err) console.error(err); });
    }
};
