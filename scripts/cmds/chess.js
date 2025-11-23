import { Chess } from 'chess.js';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));

const generateBoardImage = async (fen, perspective = 'w') => {
    const chess = new Chess(fen);
    const board = chess.board();

    const boardSize = 400;
    const squareSize = boardSize / 8;
    const padding = 30;
    const canvasSize = boardSize + padding;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    const lightColor = '#f0d9b5';
    const darkColor = '#b58863';
    const fontSize = squareSize * 0.8;
    const labelFontSize = 20;

    const isWhitePov = perspective === 'w';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isLight = (row + col) % 2 === 0;
            ctx.fillStyle = isLight ? lightColor : darkColor;
            ctx.fillRect(padding + col * squareSize, row * squareSize, squareSize, squareSize);

            const rankIndex = isWhitePov ? row : 7 - row;

            const fileIndex = isWhitePov ? col : 7 - col;

            const piece = board[rankIndex][fileIndex];

            if (piece) {
                const symbol = getPieceSymbol(piece);
                ctx.fillStyle = piece.color === 'w' ? '#ffffff' : '#000000';

                if (piece.color === 'w') {
                    ctx.shadowColor = "black";
                    ctx.shadowBlur = 2;
                } else {
                    ctx.shadowColor = "white";
                    ctx.shadowBlur = 0; 
                }

                ctx.font = `${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(symbol, padding + col * squareSize + squareSize / 2, row * squareSize + squareSize / 2);

                ctx.shadowBlur = 0;
            }
        }
    }

    ctx.fillStyle = '#000000';
    ctx.font = `${labelFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < 8; row++) {
        const rankNumber = isWhitePov ? (8 - row) : (row + 1);
        ctx.fillText(rankNumber.toString(), padding / 2, row * squareSize + squareSize / 2);
    }

    for (let col = 0; col < 8; col++) {
        const fileLetter = isWhitePov ? String.fromCharCode(97 + col) : String.fromCharCode(104 - col);
        ctx.fillText(fileLetter, padding + col * squareSize + squareSize / 2, boardSize + padding / 2);
    }

    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const imagePath = path.join(cacheDir, `chess_${Date.now()}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);
    return imagePath;
};

const getPieceSymbol = (piece) => {
    const symbols = {
        w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
        b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
    };
    return symbols[piece.color][piece.type];
};

export default {
    config: {
        name: "chess",
        cooldown: 5,
        aliase: ["chessgame"],
        description: "Play a game of chess. The board rotates for the current player.",
        category: "game",
        usage: `${global.client.config.PREFIX}chess`
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;
        const senderId = event.key.participant || event.key.remoteJid;

        const chess = new Chess();
        const players = { w: senderId, b: null };

        const imagePath = await generateBoardImage(chess.fen(), 'w');
        if (!imagePath) {
            return await sock.sendMessage(chatId, { text: "Failed to generate board." }, { quoted: event });
        }

        const sentMessage = await sock.sendMessage(chatId, {
            image: { url: imagePath },
            caption: `♟️ Chess Game Started!\n\n⚪ Current Turn: White (@${senderId.split('@')[0]})\n\nReply with move (e.g., e2 e4).\nWaiting for Player 2 (Black) to join by replying!`,
            mentions: [senderId]
        }, { quoted: event });

        global.client.replies.set(sentMessage.key.id, {
            commandName: "chess",
            chess: chess,
            players: players,
            mid: sentMessage
        });

        fs.unlink(imagePath, (err) => { if (err) console.error(err); });
    },

    onReply: async ({ sock, event, args, data, threadID, senderID, message }) => {
        const { chess, players, mid } = data;
        const chatId = threadID;
        const replyText = event.message?.conversation || event.message?.extendedTextMessage?.text || '';

        if (chess.turn() === 'b' && !players.b) {
            if (senderID === players.w) {
                return await sock.sendMessage(chatId, { text: "Wait for a second player to join." }, { quoted: event });
            }
            players.b = senderID;
        }

        const currentTurnColor = chess.turn();
        const authorizedPlayer = players[currentTurnColor];

        if (authorizedPlayer && authorizedPlayer !== senderID) {
            return await sock.sendMessage(
                chatId,
                { text: `Not your turn! It is ${currentTurnColor === 'w' ? 'White' : 'Black'}'s turn.` },
                { quoted: event }
            );
        }

        if (replyText.toLowerCase() === 'resign') {
            const winner = currentTurnColor === 'w' ? 'Black' : 'White';
            await sock.sendMessage(chatId, { text: `🏳️ ${currentTurnColor === 'w' ? 'White' : 'Black'} resigned. ${winner} wins!` }, { quoted: event });
            return;
        }

        const moveParts = replyText.trim().split(/\s+/);
        let moveConfig = {};
        if (moveParts.length === 2) {
            moveConfig = { from: moveParts[0], to: moveParts[1], promotion: 'q' };
        } else {
            moveConfig = replyText.trim();
        }

        try {
            const move = chess.move(moveConfig);
            if (!move) throw new Error("Invalid move");
        } catch (error) {
            return await sock.sendMessage(
                chatId,
                { text: "Invalid move. Use standard notation (e.g., e2 e4)." },
                { quoted: event }
            );
        }

        let gameOverMessage = '';
        if (chess.isCheckmate()) gameOverMessage = `Checkmate! ${currentTurnColor === 'w' ? 'White' : 'Black'} wins!`;
        else if (chess.isStalemate()) gameOverMessage = "Stalemate! Draw.";
        else if (chess.isDraw()) gameOverMessage = "Draw!";
        else if (chess.isCheck()) gameOverMessage = "Check!";

        const nextTurn = chess.turn();
        const imagePath = await generateBoardImage(chess.fen(), nextTurn);
        
        if (!imagePath) return await sock.sendMessage(chatId, { text: "Error generating board." }, { quoted: event });

        const nextPlayerId = players[nextTurn];
        const caption = `♟️ Chess Game\n\n${gameOverMessage ? gameOverMessage : `Current Turn: ${nextTurn === 'w' ? '⚪ White' : '⚫ Black'}`}\nPlayer: @${nextPlayerId ? nextPlayerId.split('@')[0] : 'Waiting...'}\n\n${gameOverMessage ? '' : `Board is flipped for ${nextTurn === 'w' ? 'White' : 'Black'}.\nReply with move.`}`;

        const sentMessage = await sock.sendMessage(chatId, {
            image: { url: imagePath },
            caption: caption,
            mentions: nextPlayerId ? [nextPlayerId] : []
        }, { quoted: event });

        try {
            if (mid) await message.unsend(mid);
        } catch (e) {
            // ignore
        }

        if (!chess.isGameOver()) {
            global.client.replies.set(sentMessage.key.id, {
                commandName: "chess",
                chess: chess,
                players: players,
                mid: sentMessage
            });
        }

        fs.unlink(imagePath, (err) => { if (err) console.error(err); });
    }
};
