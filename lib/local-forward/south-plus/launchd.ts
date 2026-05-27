import os from 'node:os';
import path from 'node:path';

const southPlusLaunchAgentLabel = 'cc.rsshub.south-plus';

const getSouthPlusLaunchAgentPaths = () => {
    const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const logsDir = path.join(os.homedir(), 'Library', 'Logs', 'RSSHub');
    const plistPath = path.join(launchAgentsDir, `${southPlusLaunchAgentLabel}.plist`);

    return {
        launchAgentsDir,
        logsDir,
        plistPath,
    };
};

const xmlEscape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

const buildSouthPlusLaunchAgentPlist = (repoPath: string) => {
    const scriptPath = path.join(repoPath, 'scripts', 'macos', 'start-rsshub.sh');
    const { logsDir } = getSouthPlusLaunchAgentPaths();

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${southPlusLaunchAgentLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>${xmlEscape(scriptPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(repoPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>RSSHUB_REPO_PATH</key>
    <string>${xmlEscape(repoPath)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(path.join(logsDir, 'south-plus.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(path.join(logsDir, 'south-plus.err.log'))}</string>
</dict>
</plist>
`;
};

export { buildSouthPlusLaunchAgentPlist, getSouthPlusLaunchAgentPaths, southPlusLaunchAgentLabel };
