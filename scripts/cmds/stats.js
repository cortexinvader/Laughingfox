import os from "os";

export default {
    config: {
        name: "stats",
        description: "Check bot info and vps info",
        usage: "!ping",
        category: "utility",
        role: 0
    },
    onRun: async ({ sock, event, threadID, args, font, getTable }) => {
        const start = Date.now();
        const msg = await sock.sendMessage(threadID, {
            text: `...Loading...`
        });

        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        
        const cpuCores = os.cpus();
        const cpuModel = cpuCores[0].model;
        const cpuSpeedGHz = (cpuCores[0].speed / 1000).toFixed(2); 

        const nodeInfo = process.versions.node;
        const latency = Date.now() - start;

        const users = await getTable("userData");
        const threads = await getTable("groupData");

        const report = `
${font.bold("Bot Status")}
• Latency: ${latency}ms
• Uptime: ${formatUptime(process.uptime() * 1000)}
• CPU Cores: ${cpuCores.length}
• CPU Model: ${cpuModel}
• CPU Speed: ${cpuSpeedGHz} GHz

${font.bold("Memory Usage")}
• Total: ${formatBytes(totalMemory)}
• Used: ${formatBytes(usedMemory)}
• Free: ${formatBytes(freeMemory)}

${font.bold("System Info")}
• Platform: ${os.platform()} (${os.arch()})
• Hostname: ${os.hostname()}
• Node.js: ${nodeInfo}
• OS: ${getOSInfo()}

${font.bold("Bot Information")}
• Users: ${users.length}
• Threads: ${threads.length}
`;

        await sock.sendMessage(threadID, {
            text: report,
            edit: msg.key
        });
    }
};

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

function getOSInfo() {
    return `${os.type()} ${os.release()} ${os.arch()}`;
}
