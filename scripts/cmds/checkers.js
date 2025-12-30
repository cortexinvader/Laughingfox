import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "canvas";
const __dirname = dirname(fileURLToPath(import.meta.url));

class CheckersGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentPlayer = 1;
        this.eatenWhite = 0;
        this.eatenBlack = 0;
    }

    initializeBoard() {
        const board = Array(8)
            .fill()
            .map(() => Array(8).fill(0));
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if ((row + col) % 2 === 1) {
                    if (row < 3) board[row][col] = 1;
                    else if (row > 4) board[row][col] = 2;
                }
            }
        }
        return board;
    }

    hasJumps(player) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (
                    this.board[r][c] !== 0 &&
                    this.board[r][c] % 2 === player % 2
                ) {
                    const dirs = [
                        [1, 1],
                        [1, -1],
                        [-1, 1],
                        [-1, -1]
                    ];
                    for (let [dr, dc] of dirs) {
                        if (this.isJump(r, c, r + 2 * dr, c + 2 * dc))
                            return true;
                    }
                }
            }
        }
        return false;
    }

    isJump(fromRow, fromCol, toRow, toCol) {
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
        if (this.board[toRow][toCol] !== 0) return false;
        const piece = this.board[fromRow][fromCol];
        if (piece === 0) return false;
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        if (rowDiff !== 2 || colDiff !== 2) return false;
        const midRow = (fromRow + toRow) / 2;
        const midCol = (fromCol + toCol) / 2;
        const midPiece = this.board[midRow][midCol];
        return midPiece !== 0 && midPiece % 2 !== piece % 2;
    }

    isValidMove(fromRow, fromCol, toRow, toCol, mustJump = false) {
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
        if (this.board[toRow][toCol] !== 0) return false;
        const piece = this.board[fromRow][fromCol];
        if (
            piece === 0 ||
            (piece === 1 && this.currentPlayer !== 1) ||
            (piece === 2 && this.currentPlayer !== 2)
        )
            return false;

        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        const isKing = piece > 2;

        if (colDiff === 2 && Math.abs(rowDiff) === 2) {
            return this.isJump(fromRow, fromCol, toRow, toCol);
        } else if (!mustJump && colDiff === 1 && Math.abs(rowDiff) === 1) {
            if (!isKing) {
                const direction = this.currentPlayer === 1 ? 1 : -1;
                if (rowDiff !== direction) return false;
            }
            return true;
        }
        return false;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = 0;
        this.board[toRow][toCol] = piece;

        if (piece === 1 && toRow === 7) this.board[toRow][toCol] = 3;
        if (piece === 2 && toRow === 0) this.board[toRow][toCol] = 4;
        if (Math.abs(toRow - fromRow) === 2) {
            const midRow = (fromRow + toRow) / 2;
            const midCol = (fromCol + toCol) / 2;
            const midPiece = this.board[midRow][midCol];
            this.board[midRow][midCol] = 0;
            if (midPiece === 1 || midPiece === 3) this.eatenWhite++;
            else if (midPiece === 2 || midPiece === 4) this.eatenBlack++;
        }
    }

    isGameOver() {
        const whitePieces = this.board
            .flat()
            .filter(p => p === 1 || p === 3).length;
        const blackPieces = this.board
            .flat()
            .filter(p => p === 2 || p === 4).length;
        if (whitePieces === 0) return { winner: 2, reason: "Black wins!" };
        if (blackPieces === 0) return { winner: 1, reason: "White wins!" };
        if (!this.getPossibleMoves())
            return {
                winner: this.currentPlayer === 1 ? 2 : 1,
                reason: "No moves left!"
            };
        return null;
    }

    getPossibleMoves() {
        const mustJump = this.hasJumps(this.currentPlayer);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (
                    this.board[r][c] !== 0 &&
                    this.board[r][c] % 2 === this.currentPlayer % 2
                ) {
                    const dirs = [
                        [1, 1],
                        [1, -1],
                        [-1, 1],
                        [-1, -1]
                    ];
                    for (let [dr, dc] of dirs) {
                        if (
                            this.isValidMove(r, c, r + dr, c + dc, mustJump) ||
                            this.isValidMove(
                                r,
                                c,
                                r + 2 * dr,
                                c + 2 * dc,
                                mustJump
                            )
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}

const generateBoardImage = async game => {
    const boardSize = 400;
    const squareSize = boardSize / 8;
    const padding = 30;
    const headerHeight = 50;
    const canvasSizeX = boardSize + padding;
    const canvasSizeY = boardSize + padding + headerHeight;
    const canvas = createCanvas(canvasSizeX, canvasSizeY);
    const ctx = canvas.getContext("2d");

    const lightColor = "#f0d9b5";
    const darkColor = "#b58863";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSizeX, headerHeight);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasSizeX, headerHeight);

    ctx.fillStyle = "#000000";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const headerText = `White Eaten: ${game.eatenWhite} | Black Eaten: ${game.eatenBlack}`;
    ctx.fillText(headerText, canvasSizeX / 2, headerHeight / 2);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isLight = (row + col) % 2 === 0;
            ctx.fillStyle = isLight ? lightColor : darkColor;
            ctx.fillRect(
                padding + col * squareSize,
                headerHeight + row * squareSize,
                squareSize,
                squareSize
            );

            const piece = game.board[row][col];
            if (piece !== 0) {
                const centerX = padding + col * squareSize + squareSize / 2;
                const centerY =
                    headerHeight + row * squareSize + squareSize / 2;
                const radius = squareSize / 3;

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                if (piece === 3) ctx.fillStyle = "#ff0000";
                else if (piece === 4) ctx.fillStyle = "#0000ff";
                else ctx.fillStyle = piece === 1 ? "#ffffff" : "#000000";
                ctx.fill();
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2;
                ctx.stroke();
                if (piece === 3 || piece === 4) {
                    ctx.fillStyle = "#ffd700";
                    ctx.font = `${radius}px Arial`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("♔", centerX, centerY);
                }
            }
        }
    }
    ctx.fillStyle = "#000000";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let row = 0; row < 8; row++) {
        const rankNumber = 8 - row;
        ctx.fillText(
            rankNumber.toString(),
            padding / 2,
            headerHeight + row * squareSize + squareSize / 2
        );
    }
    for (let col = 0; col < 8; col++) {
        const fileLetter = String.fromCharCode(97 + col);
        ctx.fillText(
            fileLetter,
            padding + col * squareSize + squareSize / 2,
            headerHeight + boardSize + padding / 2
        );
    }

    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const imagePath = path.join(cacheDir, `checkers_${Date.now()}.png`);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(imagePath, buffer);
    return imagePath;
};

const parseCoord = coord => {
    if (coord.length !== 2) return null;
    const col = coord.charCodeAt(0) - 97;
    const row = 8 - parseInt(coord[1]);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return { row, col };
};

export default {
    config: {
        name: "checkers",
        cooldown: 5,
        description: "Play a game of checkers with image-based board",
        category: "games",
        usage: `${global.client.config.PREFIX}checkers`,
        author: "lance"
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;
        const senderId = event.key.participant || event.key.remoteJid;

        const game = new CheckersGame();

        const players = { 1: senderId, 2: null };

        const imagePath = await generateBoardImage(game);
        if (!imagePath) {
            return await sock.sendMessage(
                chatId,
                { text: "Failed to generate board." },
                { quoted: event }
            );
        }

        const mustJump = game.hasJumps(game.currentPlayer);
        const sentMessage = await sock.sendMessage(
            chatId,
            {
                image: { url: imagePath },
                caption: `♟️ Checkers Game Started!\n\nCurrent Turn: White (@${senderId.split('@')[0]})\n\n${
                    mustJump ? "You must jump!" : ""
                }\n\nReply with move: fromSquare toSquare (e.g., c3 d4).\nWaiting for Player 2 to join by replying to the next move!`,
                mentions: [senderId]
            },
            { quoted: event }
        );

        global.client.replies.set(sentMessage.key.id, {
            commandName: this.config.name,
            game: game,
            players: players, 
            mid: sentMessage
        });

        fs.unlink(imagePath, err => {
            if (err) console.error(err);
        });
    },

    onReply: async ({
        sock,
        event,
        args,
        data,
        threadID,
        senderID,
        message
    }) => {
        const { game, players, mid } = data;
        const chatId = threadID;
        const replyText =
            event.message?.conversation ||
            event.message?.extendedTextMessage?.text ||
            "";

        if (game.currentPlayer === 2 && players[2] === null) {
            if (senderID === players[1]) {
                return await sock.sendMessage(chatId, { text: "You cannot play against yourself! Wait for another player." }, { quoted: event });
            }
            players[2] = senderID;
        }
        
        if (players[game.currentPlayer] && players[game.currentPlayer] !== senderID) {
            return await sock.sendMessage(
                chatId,
                { text: `Not your turn! It is ${game.currentPlayer === 1 ? 'White' : 'Black'}'s turn.` },
                { quoted: event }
            );
        }

        if (replyText.toLowerCase() === "resign") {
            const winner = game.currentPlayer === 1 ? 2 : 1;
            await sock.sendMessage(
                chatId,
                {
                    text: `${
                        game.currentPlayer === 1 ? "White" : "Black"
                    } resigned. ${winner === 1 ? "White" : "Black"} wins!`
                },
                { quoted: event }
            );
            return;
        }

        const parts = replyText.trim().split(/\s+/);
        if (parts.length < 2) {
            return await sock.sendMessage(
                chatId,
                {
                    text: "Invalid format. Use: from to (e.g., c3 d4) or more for jumps."
                },
                { quoted: event }
            );
        }

        const coords = parts.map(parseCoord);
        if (coords.some(c => !c)) {
            return await sock.sendMessage(
                chatId,
                { text: "Invalid coordinates." },
                { quoted: event }
            );
        }

        const mustJump = game.hasJumps(game.currentPlayer);
        let currentRow = coords[0].row;
        let currentCol = coords[0].col;
        const piece = game.board[currentRow][currentCol];

        for (let i = 1; i < coords.length; i++) {
            const to = coords[i];
            if (
                !game.isValidMove(
                    currentRow,
                    currentCol,
                    to.row,
                    to.col,
                    mustJump
                )
            ) {
                return await sock.sendMessage(
                    chatId,
                    { text: "Invalid move sequence." },
                    { quoted: event }
                );
            }
            game.makeMove(currentRow, currentCol, to.row, to.col);
            currentRow = to.row;
            currentCol = to.col;
        }
        
        let turnSwitched = false;
        
        if (game.hasJumps(game.currentPlayer)) {
             game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
             turnSwitched = true;
        } else {
             game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;
             turnSwitched = true;
        }

        const gameOver = game.isGameOver();
        const nextMustJump = game.hasJumps(game.currentPlayer);
        
        let caption = `♟️ Checkers\n\nCurrent Turn: ${
            game.currentPlayer === 1 ? "White" : "Black"
        }\nPlayer: @${players[game.currentPlayer] ? players[game.currentPlayer].split('@')[0] : "Waiting for Join..."}\n\n${
            nextMustJump ? "You must jump!" : ""
        }`;
        
        if (gameOver) {
            caption = `♟️ Checkers\n\n${gameOver.reason}`;
        }

        const imagePath = await generateBoardImage(game);
        if (!imagePath) {
            return await sock.sendMessage(
                chatId,
                { text: "Failed to generate board." },
                { quoted: event }
            );
        }

        const sentMessage = await sock.sendMessage(
            chatId,
            {
                image: { url: imagePath },
                caption: caption,
                mentions: players[game.currentPlayer] ? [players[game.currentPlayer]] : []
            },
            { quoted: event }
        );


        try {
            await message.unsend(mid);
        } catch (e) {
        }

        if (!gameOver) {
            global.client.replies.set(sentMessage.key.id, {
                commandName: "checkers",
                game: game,
                players: players,
                mid: sentMessage
            });
        }

        fs.unlink(imagePath, err => {
            if (err) console.error(err);
        });
    }
};
