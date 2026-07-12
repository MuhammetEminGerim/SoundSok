using System;
using System.Runtime.InteropServices;

class Program {
    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;

    static void Main(string[] args) {
        if (args.Length < 2) {
            Console.WriteLine("Usage: ptt_helper.exe <press|release> <key>");
            return;
        }

        string action = args[0].ToLower();
        string keyStr = args[1].ToUpper();
        
        byte vk = GetVirtualKey(keyStr);
        if (vk == 0) {
            Console.WriteLine("Error: Unknown virtual key: " + keyStr);
            return;
        }

        if (action == "press") {
            keybd_event(vk, 0, 0, 0);
        } else if (action == "release") {
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
        }
    }

    static byte GetVirtualKey(string key) {
        if (key.Length == 1) {
            char c = key[0];
            if (c >= 'A' && c <= 'Z') return (byte)c;
            if (c >= '0' && c <= '9') return (byte)c;
        }

        // F1 - F12
        if (key.Length >= 2 && key.StartsWith("F")) {
            int fNum;
            if (int.TryParse(key.Substring(1), out fNum) && fNum >= 1 && fNum <= 12) {
                return (byte)(0x6F + fNum); // F1 is 0x70, F12 is 0x7B
            }
        }

        switch (key) {
            case "CTRL":
            case "LCTRL": return 0xA2;
            case "RCTRL": return 0xA3;
            case "SHIFT":
            case "LSHIFT": return 0xA0;
            case "RSHIFT": return 0xA1;
            case "ALT":
            case "LALT": return 0xA4;
            case "RALT": return 0xA5;
            case "SPACE": return 0x20;
            case "CAPSLOCK":
            case "CAPS": return 0x14;
            case "TAB": return 0x09;
            case "ENTER": return 0x0D;
            case "BACKSPACE": return 0x08;
            case "ESCAPE":
            case "ESC": return 0x1B;
        }
        return 0;
    }
}
