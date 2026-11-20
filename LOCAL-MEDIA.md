# Local media mode (load media onto each TV once)

Media files live on each TV. The cloud (Vercel Blob / R2) isn't used for video traffic.
The app on Vercel still tells each TV *what* to play (tiny data), so you keep remote control of
playlists, pairing, aspect ratio, fit and rotation.

## One-time setup per TV (Fully Kiosk Browser)

1. **Make the ZIP.** Put your images/videos in a folder named `media`, then zip that folder as `media.zip`.
   Use plain English file names (Fully's docs advise against non-Latin names inside ZIPs). Videos: H.264 MP4.
2. **Make the ZIP reachable by URL.** Fully downloads it from a web address. Options:
   - **Your PC on the same Wi-Fi (the "connect once" route):** open a terminal in the folder containing
     `media.zip` and run `python -m http.server 8000`. The URL is `http://<PC-IP-ADDRESS>:8000/media.zip`.
     Keep the PC on while the TVs download, then switch it off.
   - Dropbox: use a link ending in `?dl=1`. Fully Cloud file storage works for ZIPs up to 100 MB.
   - Not Google Drive: Fully's docs say ZIP download doesn't work properly from Drive.
3. **On the TV, in Fully Kiosk:**
   - Device Management → **Load Content From ZIP File** → paste the URL (or use "Load ZIP File" in Remote Admin).
   - Advanced Web Settings → turn on **Localhost File Access**.
   - Start URL → your app address (e.g. `https://YOUR-APP.vercel.app/`).
4. **In the admin** (`/admin` → Media → *Local files*):
   - Click **Pick the files you put in the ZIP** and select the same files. Only the names are saved; nothing is uploaded.
   - Check **Folder address on the TV** (see below).
   - Build playlists as usual and assign them to screens.

## The folder address (the one thing to verify)

The default is `https://localhost/sdcard/Android/data/de.ozerov.fully/files/media/`.
Where Fully unpacks the ZIP depends on the Android version (app-specific storage on Android 11+, otherwise shared storage),
so this may need adjusting. To find the right path: in Fully's URL dialog, use the **file picker** to browse to one of the
unpacked files, note its path, and write it as `https://localhost/<that path>`. Test by opening that address on the TV:
the image or video should show. Enter the folder part (ending in `/media/`) in the admin.

If a TV can't load a file, it shows the address it tried on screen so you can see what's wrong.

## Updating media later

Make a new `media.zip`, replace the old one at the same URL. Fully checks for a newer ZIP about once an hour
(it relies on the server's Last-Modified header) and re-unpacks, overwriting files with the same names.
To remove old files, include a `.delete` file in the ZIP listing the files/folders to delete first.
Then add the new file names in the admin and edit playlists.

## Offline behaviour

After a TV has loaded the player once, it saves the page and its last playlist, and the media is local.
It should keep playing, and start up again, without internet. This is best-effort; test it by unplugging a TV's network.
