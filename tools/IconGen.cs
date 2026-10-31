using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

// Рисует иконку и заставки AssistManager: «масляный» фон и огонёк в охре и ржавчине.
public static class IconGen
{
    static Color C(string hex, int a = 255)
    {
        hex = hex.TrimStart('#');
        return Color.FromArgb(a, Convert.ToInt32(hex.Substring(0, 2), 16), Convert.ToInt32(hex.Substring(2, 2), 16), Convert.ToInt32(hex.Substring(4, 2), 16));
    }

    static Graphics G(Bitmap b)
    {
        var g = Graphics.FromImage(b);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        return g;
    }

    // Фон: тёмный градиент, россыпь мазков, тёплое свечение снизу, виньетка.
    public static void PaintBg(Graphics g, int w, int h, int seed)
    {
        var rnd = new Random(seed);
        using (var lg = new LinearGradientBrush(new Point(0, 0), new Point((int)(w * .4), h), C("#1d1528"), C("#120e19")))
            g.FillRectangle(lg, 0, 0, w, h);
        string[] cols = { "#3a2a52", "#2a1f3d", "#4b3668", "#231a31", "#563f73", "#1b1526", "#33264a", "#2f2240", "#47345e" };
        string[] warm = { "#5a2a1c", "#7a3a22", "#8a5a2c" };
        int n = (int)((double)w * h / 1500);
        double side = Math.Min(w, h);
        for (int i = 0; i < n; i++)
        {
            double x = rnd.NextDouble() * w, y = rnd.NextDouble() * h;
            string col = rnd.NextDouble() < (y / h) * 0.35 ? warm[rnd.Next(3)] : cols[rnd.Next(cols.Length)];
            double L = side / 18 + rnd.NextDouble() * side / 6, T = side / 90 + rnd.NextDouble() * side / 40;
            var st = g.Save();
            g.TranslateTransform((float)x, (float)y);
            g.RotateTransform((float)(-50 + rnd.NextDouble() * 30 + (rnd.NextDouble() < .2 ? 80 : 0)));
            using (var b = new SolidBrush(C(col, (int)(14 + rnd.NextDouble() * 40))))
                g.FillEllipse(b, (float)-L, (float)-T, (float)(2 * L), (float)(2 * T));
            g.Restore(st);
        }
        using (var path = new GraphicsPath())
        {
            path.AddEllipse(w * .1f, h * .25f, w * .8f, h * .8f);
            using (var pg = new PathGradientBrush(path))
            {
                pg.CenterColor = C("#a8481f", 120);
                pg.SurroundColors = new[] { C("#a8481f", 0) };
                g.FillPath(pg, path);
            }
        }
        using (var vp = new GraphicsPath())
        {
            vp.AddEllipse(-w * .35f, -h * .35f, w * 1.7f, h * 1.7f);
            using (var vg = new PathGradientBrush(vp))
            {
                vg.CenterColor = C("#06040a", 0);
                vg.SurroundColors = new[] { C("#06040a", 200) };
                vg.FocusScales = new PointF(.55f, .55f);
                g.FillPath(vg, vp);
            }
        }
    }

    // Контур пламени (x от -1 до 1, y от 0 до 1 вверх), масштаб k.
    static GraphicsPath FlamePath(double cx, double by, double hw, double ht, double k)
    {
        Func<double, double, PointF> P = (x, y) => new PointF((float)(cx + x * hw * k), (float)(by - y * ht * k));
        var p = new GraphicsPath();
        p.AddBezier(P(0, 0), P(-0.95, 0.0), P(-1.05, 0.36), P(-0.62, 0.60));
        p.AddBezier(P(-0.62, 0.60), P(-0.40, 0.72), P(-0.52, 0.86), P(-0.40, 0.96));
        p.AddBezier(P(-0.40, 0.96), P(-0.10, 0.84), P(-0.02, 0.70), P(0.10, 1.0));
        p.AddBezier(P(0.10, 1.0), P(0.28, 0.84), P(0.62, 0.74), P(0.66, 0.48));
        p.AddBezier(P(0.66, 0.48), P(0.98, 0.30), P(0.80, 0.0), P(0, 0));
        p.CloseFigure();
        return p;
    }

    public static void DrawFlame(Graphics g, double cx, double by, double hw, double ht, int seed, bool glow)
    {
        if (glow)
        {
            using (var gp = new GraphicsPath())
            {
                gp.AddEllipse((float)(cx - hw * 1.9), (float)(by - ht * 1.15), (float)(hw * 3.8), (float)(ht * 1.5));
                using (var gb = new PathGradientBrush(gp))
                {
                    gb.CenterColor = C("#e0812b", 150);
                    gb.SurroundColors = new[] { C("#e0812b", 0) };
                    g.FillPath(gb, gp);
                }
            }
        }
        object[][] layers = {
            new object[] { 1.0, "#8f2f1e", "#d0573e" },
            new object[] { 0.74, "#c4702a", "#e8b04c" },
            new object[] { 0.44, "#e9b85a", "#fbe9b0" },
        };
        foreach (var l in layers)
        {
            using (var path = FlamePath(cx, by, hw, ht, (double)l[0]))
            {
                var rect = path.GetBounds();
                using (var br = new LinearGradientBrush(rect, C((string)l[1]), C((string)l[2]), 270f))
                    g.FillPath(br, path);
                using (var pen = new Pen(C("#1a0a05", 90), (float)(hw * 0.025)))
                    g.DrawPath(pen, path);
            }
        }
        var rnd = new Random(seed);
        string[] sc = { "#fff0c0", "#f3b25a", "#b4412c" };
        for (int i = 0; i < 26; i++)
        {
            double x = cx + (rnd.NextDouble() - .5) * hw * 1.2, y = by - rnd.NextDouble() * ht * .8;
            var st = g.Save();
            g.TranslateTransform((float)x, (float)y);
            g.RotateTransform((float)(-80 + rnd.NextDouble() * 20));
            using (var b = new SolidBrush(C(sc[rnd.Next(3)], (int)(30 + rnd.NextDouble() * 50))))
                g.FillEllipse(b, (float)(-hw * .18), (float)(-hw * .03), (float)(hw * .36), (float)(hw * .06));
            g.Restore(st);
        }
    }

    // Основа для иконок: размер S x S. fg — только огонёк на прозрачном, bg — только фон, full — всё вместе.
    static Bitmap Master(int s, string kind)
    {
        var b = new Bitmap(s, s, PixelFormat.Format32bppArgb);
        using (var g = G(b))
        {
            if (kind != "fg") PaintBg(g, s, s, 7);
            if (kind != "bg")
            {
                // для adaptive-иконки важна центральная «безопасная зона» ~66%, огонь делаем в ней
                double scale = kind == "fg" ? 0.56 : 0.74;
                double ht = s * scale, hw = ht * 0.44;
                DrawFlame(g, s * 0.5, s * (kind == "fg" ? 0.5 + scale * 0.5 : 0.5 + scale * 0.5), hw, ht, 3, kind == "full");
            }
        }
        return b;
    }

    static Bitmap Scale(Bitmap src, int s)
    {
        var b = new Bitmap(s, s, PixelFormat.Format32bppArgb);
        using (var g = G(b)) g.DrawImage(src, 0, 0, s, s);
        return b;
    }

    static Bitmap Mask(Bitmap src, bool round)
    {
        int s = src.Width;
        var b = new Bitmap(s, s, PixelFormat.Format32bppArgb);
        using (var g = G(b))
        using (var path = new GraphicsPath())
        {
            if (round) path.AddEllipse(0, 0, s, s);
            else
            {
                float r = s * 0.22f, d = r * 2;
                path.AddArc(0, 0, d, d, 180, 90); path.AddArc(s - d, 0, d, d, 270, 90);
                path.AddArc(s - d, s - d, d, d, 0, 90); path.AddArc(0, s - d, d, d, 90, 90);
                path.CloseFigure();
            }
            g.SetClip(path);
            g.DrawImage(src, 0, 0, s, s);
        }
        return b;
    }

    static void Save(Bitmap b, string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        b.Save(path, ImageFormat.Png);
    }

    public static void Preview(string dir)
    {
        using (var m = Master(1024, "full")) Save(m, Path.Combine(dir, "preview-full.png"));
        using (var m = Master(1024, "fg")) Save(m, Path.Combine(dir, "preview-fg.png"));
    }

    // Все размеры иконок Android + заставка. res — папка app/src/main/res.
    public static void Generate(string res)
    {
        var dens = new[] { new[] { "mdpi", "48", "108" }, new[] { "hdpi", "72", "162" }, new[] { "xhdpi", "96", "216" }, new[] { "xxhdpi", "144", "324" }, new[] { "xxxhdpi", "192", "432" } };
        using (var full = Master(1024, "full"))
        using (var fg = Master(1024, "fg"))
        using (var bg = Master(1024, "bg"))
        {
            foreach (var d in dens)
            {
                int icon = int.Parse(d[1]), ad = int.Parse(d[2]);
                string dir = Path.Combine(res, "mipmap-" + d[0]);
                using (var s = Scale(full, icon)) using (var sq = Mask(s, false)) Save(sq, Path.Combine(dir, "ic_launcher.png"));
                using (var s = Scale(full, icon)) using (var rd = Mask(s, true)) Save(rd, Path.Combine(dir, "ic_launcher_round.png"));
                using (var s = Scale(fg, ad)) Save(s, Path.Combine(dir, "ic_launcher_foreground.png"));
                using (var s = Scale(bg, ad)) Save(s, Path.Combine(dir, "ic_launcher_bg.png"));
            }
        }
        // Заставка: фон по размеру каждого существующего файла, огонёк по центру.
        foreach (var f in Directory.GetFiles(res, "splash.png", SearchOption.AllDirectories))
        {
            int w, h;
            using (var old = Image.FromFile(f)) { w = old.Width; h = old.Height; }
            using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                using (var g = G(b))
                {
                    PaintBg(g, w, h, 11);
                    double ht = Math.Min(w, h) * 0.30, hw = ht * 0.44;
                    DrawFlame(g, w * 0.5, h * 0.5 + ht * 0.5, hw, ht, 5, true);
                }
                string tmp = f + ".new";
                b.Save(tmp, ImageFormat.Png);
                File.Delete(f); File.Move(tmp, f);
            }
        }
    }
}
