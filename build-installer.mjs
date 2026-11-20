/**
 * TRÌNH ĐÓNG GÓI BỘ CÀI ĐẶT .EXE 1-CLICK CHO NGƯỜI DÙNG KHÔNG RÀNH GITHUB / NODE.JS
 * Xuất bản:
 *  1) Pho-Co-Ba-3D.exe                        --> File chạy trực tiếp không hiện CMD đen
 *  2) dist/Pho-Co-Ba-3D-Setup-v2.0.exe        --> 1 FILE CÀI ĐẶT .EXE DUY NHẤT (nhúng sẵn Node.js + node_modules + tạo icon Desktop)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.join(ROOT_DIR, 'dist');
const STAGE_DIR = path.join(DIST_ROOT, 'Pho-Co-Ba-3D-Package');
const SETUP_EXE_PATH = path.join(DIST_ROOT, 'Pho-Co-Ba-3D-Setup-v2.0.exe');

function findCscExe() {
  const candidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Không tìm thấy trình biên dịch C# (csc.exe) của Windows .NET Framework.');
}

function copyDirectorySync(src, dest, exclude = new Set()) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      if (exclude.has(child)) continue;
      copyDirectorySync(path.join(src, child), path.join(dest, child), exclude);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function compileAppLauncherExe(cscPath, outputExePath) {
  const csSource = `
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

class PhoCoBaLauncher
{
    static bool IsPortListening(int port)
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                var result = client.BeginConnect("127.0.0.1", port, null, null);
                bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(350));
                if (!success) return false;
                client.EndConnect(result);
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    static string ResolveNodeExe(string appDir)
    {
        string bundledNode = Path.Combine(appDir, "runtime", "node.exe");
        if (File.Exists(bundledNode)) return bundledNode;
        string progNode = @"C:\\Program Files\\nodejs\\node.exe";
        if (File.Exists(progNode)) return progNode;
        return "node";
    }

    static void OpenAppWindow(string url)
    {
        string[] browserPaths = new string[]
        {
            @"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            @"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            @"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            @"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
        };

        foreach (string bp in browserPaths)
        {
            if (File.Exists(bp))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = bp,
                    Arguments = "--app=\\"" + url + "\\" --start-maximized",
                    UseShellExecute = true
                });
                return;
            }
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        });
    }

    [STAThread]
    static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string gameDir = Path.Combine(appDir, "games", "curry-shop-3d");
        string serverMjs = Path.Combine(gameDir, "server.mjs");

        if (!File.Exists(serverMjs))
        {
            MessageBox.Show("Không tìm thấy file games\\\\curry-shop-3d\\\\server.mjs tại: " + appDir, "Phở Cô Ba 3D - LIVE-PHO-TIKTOK", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        if (!IsPortListening(4011))
        {
            string nodeExe = ResolveNodeExe(appDir);
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\\"server.mjs\\"",
                    WorkingDirectory = gameDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                psi.EnvironmentVariables["PORT"] = "4011";
                psi.EnvironmentVariables["BRIDGE_PORT"] = "4012";
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Không thể khởi động Node Runtime: " + ex.Message + "\\n\\nVui lòng chạy bản cài đặt Pho-Co-Ba-3D-Setup-v2.0.exe hoặc cài đặt Node.js từ https://nodejs.org", "Phở Cô Ba 3D", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            for (int i = 0; i < 25; i++)
            {
                if (IsPortListening(4011)) break;
                Thread.Sleep(200);
            }
        }

        OpenAppWindow("http://localhost:4011");
    }
}
`;
  const tempCs = path.join(DIST_ROOT, '_TempPhoLauncher.cs');
  fs.writeFileSync(tempCs, csSource, 'utf8');
  execFileSync(cscPath, [
    '/target:winexe',
    '/optimize+',
    `/out:${outputExePath}`,
    '/r:System.dll',
    '/r:System.Windows.Forms.dll',
    tempCs
  ]);
  fs.unlinkSync(tempCs);
}

function compileSetupStubExe(cscPath, outputStubPath) {
  const csSource = `
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public class SubStream : Stream
{
    private readonly Stream _baseStream;
    private readonly long _baseOffset;
    private readonly long _length;
    private long _position;

    public SubStream(Stream baseStream, long baseOffset, long length)
    {
        _baseStream = baseStream;
        _baseOffset = baseOffset;
        _length = length;
        _position = 0;
        _baseStream.Seek(_baseOffset, SeekOrigin.Begin);
    }

    public override bool CanRead { get { return true; } }
    public override bool CanSeek { get { return true; } }
    public override bool CanWrite { get { return false; } }
    public override long Length { get { return _length; } }

    public override long Position
    {
        get { return _position; }
        set { Seek(value, SeekOrigin.Begin); }
    }

    public override void Flush() { }

    public override int Read(byte[] buffer, int offset, int count)
    {
        long remaining = _length - _position;
        if (remaining <= 0) return 0;
        if (count > remaining) count = (int)remaining;
        _baseStream.Seek(_baseOffset + _position, SeekOrigin.Begin);
        int read = _baseStream.Read(buffer, offset, count);
        _position += read;
        return read;
    }

    public override long Seek(long offset, SeekOrigin origin)
    {
        long newPos = _position;
        if (origin == SeekOrigin.Begin) newPos = offset;
        else if (origin == SeekOrigin.Current) newPos = _position + offset;
        else if (origin == SeekOrigin.End) newPos = _length + offset;

        if (newPos < 0) newPos = 0;
        if (newPos > _length) newPos = _length;
        _position = newPos;
        _baseStream.Seek(_baseOffset + _position, SeekOrigin.Begin);
        return _position;
    }

    public override void SetLength(long value) { throw new NotSupportedException(); }
    public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
}

public class SetupForm : Form
{
    private Label lblTitle;
    private Label lblSub;
    private Label lblStatus;
    private ProgressBar progressBar;
    private Button btnInstall;
    private Button btnClose;
    private TextBox txtInstallPath;
    private CheckBox chkDesktopShortcut;
    private CheckBox chkLaunchNow;

    public SetupForm()
    {
        this.Text = "Cài Đặt Phở Cô Ba 3D (LIVE-PHO-TIKTOK v2.0) - Duong Birken";
        this.Size = new Size(575, 405);
        this.FormBorderStyle = FormBorderStyle.FixedDialog;
        this.MaximizeBox = false;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(15, 23, 42);
        this.ForeColor = Color.White;
        this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        lblTitle = new Label();
        lblTitle.Text = "🍜 PHỞ CÔ BA 3D — LIVE-PHO-TIKTOK v2.0";
        lblTitle.Font = new Font("Segoe UI", 15.5f, FontStyle.Bold);
        lblTitle.ForeColor = Color.FromArgb(251, 191, 36);
        lblTitle.Location = new Point(28, 20);
        lblTitle.Size = new Size(515, 34);
        this.Controls.Add(lblTitle);

        lblSub = new Label();
        lblSub.Text = "Game Mô Phỏng Quán Phở Đêm 3D Tương Tác Tự Động 100% Cho TikTok LIVE\\nTích hợp sẵn Node.js Runtime, Giọng AI Cô Ba, Nhạc nền 90 BPM & Nhân vật Chibi 3D.";
        lblSub.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
        lblSub.ForeColor = Color.FromArgb(203, 213, 225);
        lblSub.Location = new Point(30, 58);
        lblSub.Size = new Size(515, 44);
        this.Controls.Add(lblSub);

        Label lblDir = new Label();
        lblDir.Text = "Thư mục cài đặt trên máy của bạn:";
        lblDir.ForeColor = Color.FromArgb(148, 163, 184);
        lblDir.Location = new Point(30, 114);
        lblDir.Size = new Size(300, 20);
        this.Controls.Add(lblDir);

        string defaultDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Pho-Co-Ba-3D");
        txtInstallPath = new TextBox();
        txtInstallPath.Text = defaultDir;
        txtInstallPath.BackColor = Color.FromArgb(30, 41, 59);
        txtInstallPath.ForeColor = Color.White;
        txtInstallPath.BorderStyle = BorderStyle.FixedSingle;
        txtInstallPath.Location = new Point(30, 136);
        txtInstallPath.Size = new Size(500, 26);
        this.Controls.Add(txtInstallPath);

        chkDesktopShortcut = new CheckBox();
        chkDesktopShortcut.Text = "Tạo biểu tượng 'Phở Cô Ba 3D - TikTok LIVE' ngoài màn hình Desktop";
        chkDesktopShortcut.Checked = true;
        chkDesktopShortcut.ForeColor = Color.FromArgb(226, 232, 240);
        chkDesktopShortcut.Location = new Point(30, 174);
        chkDesktopShortcut.Size = new Size(500, 24);
        this.Controls.Add(chkDesktopShortcut);

        chkLaunchNow = new CheckBox();
        chkLaunchNow.Text = "Mở ngay Phở Cô Ba 3D (Port 4011) sau khi cài đặt xong";
        chkLaunchNow.Checked = true;
        chkLaunchNow.ForeColor = Color.FromArgb(226, 232, 240);
        chkLaunchNow.Location = new Point(30, 200);
        chkLaunchNow.Size = new Size(500, 24);
        this.Controls.Add(chkLaunchNow);

        lblStatus = new Label();
        lblStatus.Text = "Sẵn sàng cài đặt (Đã nhúng sẵn toàn bộ thư viện, không cần cài Node.js).";
        lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
        lblStatus.Location = new Point(30, 236);
        lblStatus.Size = new Size(500, 22);
        this.Controls.Add(lblStatus);

        progressBar = new ProgressBar();
        progressBar.Location = new Point(30, 262);
        progressBar.Size = new Size(500, 22);
        progressBar.Minimum = 0;
        progressBar.Maximum = 100;
        progressBar.Value = 0;
        this.Controls.Add(progressBar);

        btnInstall = new Button();
        btnInstall.Text = "🚀 CÀI ĐẶT NGAY (1-CLICK)";
        btnInstall.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
        btnInstall.BackColor = Color.FromArgb(217, 119, 6);
        btnInstall.ForeColor = Color.White;
        btnInstall.FlatStyle = FlatStyle.Flat;
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Location = new Point(30, 302);
        btnInstall.Size = new Size(375, 42);
        btnInstall.Cursor = Cursors.Hand;
        btnInstall.Click += BtnInstall_Click;
        this.Controls.Add(btnInstall);

        btnClose = new Button();
        btnClose.Text = "Đóng";
        btnClose.BackColor = Color.FromArgb(51, 65, 85);
        btnClose.ForeColor = Color.White;
        btnClose.FlatStyle = FlatStyle.Flat;
        btnClose.FlatAppearance.BorderSize = 0;
        btnClose.Location = new Point(415, 302);
        btnClose.Size = new Size(115, 42);
        btnClose.Cursor = Cursors.Hand;
        btnClose.Click += (s, e) => this.Close();
        this.Controls.Add(btnClose);
    }

    private void BtnInstall_Click(object sender, EventArgs e)
    {
        string targetDir = txtInstallPath.Text.Trim();
        if (string.IsNullOrEmpty(targetDir))
        {
            MessageBox.Show("Vui lòng chọn thư mục cài đặt hợp lệ!", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        btnInstall.Enabled = false;
        txtInstallPath.Enabled = false;
        chkDesktopShortcut.Enabled = false;
        chkLaunchNow.Enabled = false;

        bool createShortcut = chkDesktopShortcut.Checked;
        bool launchAfter = chkLaunchNow.Checked;

        Thread worker = new Thread(() => RunInstallation(targetDir, createShortcut, launchAfter));
        worker.IsBackground = true;
        worker.Start();
    }

    private void UpdateUi(string status, int progress)
    {
        if (this.InvokeRequired)
        {
            this.BeginInvoke(new Action(() => UpdateUi(status, progress)));
            return;
        }
        lblStatus.Text = status;
        if (progress >= 0 && progress <= 100) progressBar.Value = progress;
    }

    private static void CreateShortcut(string shortcutPath, string targetExe, string workingDir, string description)
    {
        try
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            Type scType = shortcut.GetType();
            scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
            scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDir });
            scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { description });
            scType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe + ",0" });
            scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }
        catch { }
    }

    private static void StopRunningAppProcesses(string targetDir)
    {
        try
        {
            foreach (Process p in Process.GetProcessesByName("Pho-Co-Ba-3D"))
            {
                try { p.Kill(); p.WaitForExit(1500); } catch { }
            }
        }
        catch { }

        string normTarget = "";
        try { normTarget = Path.GetFullPath(targetDir).ToLowerInvariant(); } catch { normTarget = targetDir.ToLowerInvariant(); }

        try
        {
            foreach (Process p in Process.GetProcessesByName("node"))
            {
                try
                {
                    string exePath = p.MainModule.FileName.ToLowerInvariant();
                    if ((!string.IsNullOrEmpty(normTarget) && exePath.StartsWith(normTarget)) || exePath.Contains("pho-co-ba-3d"))
                    {
                        p.Kill();
                        p.WaitForExit(1500);
                    }
                }
                catch { }
            }
        }
        catch { }
        Thread.Sleep(350);
    }

    private void RunInstallation(string targetDir, bool createShortcut, bool launchAfter)
    {
        try
        {
            UpdateUi("Đang kiểm tra và đóng phiên bản cũ (nếu đang mở)...", 3);
            StopRunningAppProcesses(targetDir);

            string selfExe = Application.ExecutablePath;
            using (FileStream fs = new FileStream(selfExe, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (fs.Length < 24)
                    throw new Exception("File cài đặt không hợp lệ.");

                fs.Seek(fs.Length - 24, SeekOrigin.Begin);
                byte[] footer = new byte[24];
                fs.Read(footer, 0, 24);

                long zipOffset = BitConverter.ToInt64(footer, 0);
                long zipLength = BitConverter.ToInt64(footer, 8);
                string magic = Encoding.ASCII.GetString(footer, 16, 8);

                if (magic != "PHOCB3D2" || zipOffset <= 0 || zipLength <= 0)
                    throw new Exception("Không tìm thấy gói dữ liệu nén bên trong bộ cài đặt.");

                Directory.CreateDirectory(targetDir);

                using (SubStream sub = new SubStream(fs, zipOffset, zipLength))
                using (ZipArchive archive = new ZipArchive(sub, ZipArchiveMode.Read))
                {
                    int total = archive.Entries.Count;
                    int current = 0;

                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        current++;
                        int pct = (int)((current * 95L) / Math.Max(1, total));
                        if (current % 12 == 0 || current == total)
                        {
                            UpdateUi(string.Format("Đang cài đặt ({0}/{1}): {2}", current, total, entry.Name), pct);
                        }

                        string fullPath = Path.Combine(targetDir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(fullPath);
                            continue;
                        }

                        string parentDir = Path.GetDirectoryName(fullPath);
                        if (!string.IsNullOrEmpty(parentDir))
                        {
                            Directory.CreateDirectory(parentDir);
                        }

                        try
                        {
                            using (Stream inStream = entry.Open())
                            using (FileStream outStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite))
                            {
                                inStream.CopyTo(outStream);
                            }
                        }
                        catch
                        {
                            if (!File.Exists(fullPath)) throw;
                        }
                    }
                }
            }

            string launcherExe = Path.Combine(targetDir, "Pho-Co-Ba-3D.exe");

            if (createShortcut && File.Exists(launcherExe))
            {
                UpdateUi("Đang tạo biểu tượng ngoài màn hình Desktop...", 97);
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                CreateShortcut(
                    Path.Combine(desktopDir, "Phở Cô Ba 3D - TikTok LIVE.lnk"),
                    launcherExe,
                    targetDir,
                    "Game Quán Phở Đêm 3D Tương Tác TikTok LIVE (Port 4011)"
                );

                string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                CreateShortcut(
                    Path.Combine(startMenuDir, "Phở Cô Ba 3D - TikTok LIVE.lnk"),
                    launcherExe,
                    targetDir,
                    "Game Quán Phở Đêm 3D Tương Tác TikTok LIVE (Port 4011)"
                );
            }

            UpdateUi("✅ Cài đặt hoàn tất 100%! Đang mở Phở Cô Ba 3D...", 100);

            if (launchAfter && File.Exists(launcherExe))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = launcherExe,
                    WorkingDirectory = targetDir,
                    UseShellExecute = true
                });
            }

            this.BeginInvoke(new Action(() =>
            {
                MessageBox.Show(
                    "🎉 Đã cài đặt thành công Phở Cô Ba 3D (LIVE-PHO-TIKTOK v2.0)!\\n\\n" +
                    "👉 Biểu tượng 'Phở Cô Ba 3D - TikTok LIVE' đã được tạo ngoài màn hình Desktop.\\n" +
                    "👉 Link gắn vào TikTok LIVE Studio (1080x1920): http://lvh.me:4011/?view=stage",
                    "Cài Đặt Hoàn Tất",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                this.Close();
            }));
        }
        catch (Exception ex)
        {
            this.BeginInvoke(new Action(() =>
            {
                btnInstall.Enabled = true;
                UpdateUi("❌ Lỗi cài đặt: " + ex.Message, 0);
                MessageBox.Show("Lỗi trong quá trình cài đặt:\\n" + ex.Message, "Lỗi Cài Đặt", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }));
        }
    }

    [STAThread]
    public static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }
}
`;
  const tempCs = path.join(DIST_ROOT, '_TempPhoSetupStub.cs');
  fs.writeFileSync(tempCs, csSource, 'utf8');
  execFileSync(cscPath, [
    '/target:winexe',
    '/optimize+',
    `/out:${outputStubPath}`,
    '/r:System.dll',
    '/r:System.Drawing.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.IO.Compression.dll',
    '/r:System.IO.Compression.FileSystem.dll',
    tempCs
  ]);
  fs.unlinkSync(tempCs);
}

function main() {
  console.log('======================================================================');
  console.log('  🍜 ĐANG ĐÓNG GÓI BỘ CÀI ĐẶT .EXE 1-CLICK: PHỞ CÔ BA 3D (v2.0)');
  console.log('======================================================================');

  fs.mkdirSync(DIST_ROOT, { recursive: true });
  if (fs.existsSync(STAGE_DIR)) {
    fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  const cscPath = findCscExe();

  // 1. Biên dịch Pho-Co-Ba-3D.exe (Launcher chạy không cần mở CMD)
  console.log('  [+] Đang biên dịch Launcher: Pho-Co-Ba-3D.exe ...');
  const rootLauncherExe = path.join(ROOT_DIR, 'Pho-Co-Ba-3D.exe');
  compileAppLauncherExe(cscPath, rootLauncherExe);
  fs.copyFileSync(rootLauncherExe, path.join(STAGE_DIR, 'Pho-Co-Ba-3D.exe'));

  // 2. Sao chép games/curry-shop-3d (kèm cả node_modules để người dùng không cần cài npm)
  console.log('  [+] Đang đóng gói games/curry-shop-3d (kèm node_modules) ...');
  copyDirectorySync(
    path.join(ROOT_DIR, 'games', 'curry-shop-3d'),
    path.join(STAGE_DIR, 'games', 'curry-shop-3d'),
    new Set(['server.log', 'server-error.log'])
  );

  // 3. Nhúng sẵn runtime/node.exe để máy người dùng chưa cài Node.js vẫn chạy 100% độc lập
  const systemNodeExe = process.execPath;
  if (systemNodeExe && fs.existsSync(systemNodeExe)) {
    console.log(`  [+] Đang nhúng Node.js Runtime độc lập (${path.basename(systemNodeExe)}) ...`);
    const runtimeDir = path.join(STAGE_DIR, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.copyFileSync(systemNodeExe, path.join(runtimeDir, 'node.exe'));
  }

  // 4. Sao chép các file tiện ích và tài liệu hướng dẫn
  for (const file of ['BAT-LIVE.bat', 'TAT-LIVE.bat', 'CHAY_QUAN_PHO_3D.bat', 'DUNG_QUAN_PHO_3D.bat', 'settings.json', 'README.md']) {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE_DIR, file));
  }
  if (fs.existsSync(path.join(ROOT_DIR, 'docs', 'USER_GUIDE.md'))) {
    fs.mkdirSync(path.join(STAGE_DIR, 'docs'), { recursive: true });
    fs.copyFileSync(path.join(ROOT_DIR, 'docs', 'USER_GUIDE.md'), path.join(STAGE_DIR, 'docs', 'USER_GUIDE.md'));
  }

  // 5. Nén STAGE_DIR thành payload.zip
  const payloadZipPath = path.join(DIST_ROOT, '_pho_payload.zip');
  if (fs.existsSync(payloadZipPath)) fs.unlinkSync(payloadZipPath);
  console.log('  [+] Đang nén gói dữ liệu vào Payload Archive ...');
  execSync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${STAGE_DIR.replace(/'/g, "''")}', '${payloadZipPath.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`,
    { stdio: 'inherit' }
  );

  // 6. Biên dịch SetupStub.exe và ghép thành 1 file cài đặt duy nhất: dist/Pho-Co-Ba-3D-Setup-v2.0.exe
  console.log('  [+] Đang đóng gói thành 1 file cài đặt duy nhất: dist/Pho-Co-Ba-3D-Setup-v2.0.exe ...');
  const stubExePath = path.join(DIST_ROOT, '_PhoSetupStub.exe');
  compileSetupStubExe(cscPath, stubExePath);

  const stubBuf = fs.readFileSync(stubExePath);
  const zipStat = fs.statSync(payloadZipPath);
  const zipOffset = BigInt(stubBuf.length);
  const zipLength = BigInt(zipStat.size);

  const footerBuf = Buffer.alloc(24);
  footerBuf.writeBigInt64LE(zipOffset, 0);
  footerBuf.writeBigInt64LE(zipLength, 8);
  footerBuf.write('PHOCB3D2', 16, 8, 'ascii');

  const outFd = fs.openSync(SETUP_EXE_PATH, 'w');
  fs.writeSync(outFd, stubBuf);

  const zipFd = fs.openSync(payloadZipPath, 'r');
  const chunkBuf = Buffer.alloc(4 * 1024 * 1024);
  let bytesRead = 0;
  while ((bytesRead = fs.readSync(zipFd, chunkBuf, 0, chunkBuf.length, null)) > 0) {
    fs.writeSync(outFd, chunkBuf, 0, bytesRead);
  }
  fs.closeSync(zipFd);
  fs.writeSync(outFd, footerBuf);
  fs.closeSync(outFd);

  fs.unlinkSync(stubExePath);
  fs.unlinkSync(payloadZipPath);
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });

  const finalSizeMb = (fs.statSync(SETUP_EXE_PATH).size / (1024 * 1024)).toFixed(2);
  console.log('======================================================================');
  console.log(`  🎉 HOÀN TẤT! File bộ cài .EXE: ${SETUP_EXE_PATH} (${finalSizeMb} MB)`);
  console.log(`  🚀 File Launcher nhanh tại gốc: ${rootLauncherExe}`);
  console.log('======================================================================');
}

main();
