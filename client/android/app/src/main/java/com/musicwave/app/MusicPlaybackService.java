package com.musicwave.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/** Keeps direct audio streams playing while the WebView is in the background. */
public class MusicPlaybackService extends Service {
    public static final String ACTION_PLAY = "com.musicwave.app.PLAY";
    public static final String ACTION_PAUSE = "com.musicwave.app.PAUSE";
    public static final String ACTION_RESUME = "com.musicwave.app.RESUME";
    public static final String ACTION_SEEK = "com.musicwave.app.SEEK";
    public static final String ACTION_VOLUME = "com.musicwave.app.VOLUME";
    public static final String ACTION_STOP = "com.musicwave.app.STOP";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_VOLUME = "volume";

    private static final String CHANNEL_ID = "music_playback";
    private static final int NOTIFICATION_ID = 1401;
    private static volatile MediaPlayer player;
    private static volatile String title = "MusicWave";
    private static volatile String artist = "Đang phát nhạc";
    private static volatile String lastError = null;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getAction();
        if (ACTION_PLAY.equals(action)) startPlayback(intent);
        else if (ACTION_PAUSE.equals(action)) pausePlayback();
        else if (ACTION_RESUME.equals(action)) resumePlayback();
        else if (ACTION_SEEK.equals(action) && player != null) player.seekTo(intent.getIntExtra(EXTRA_POSITION, 0));
        else if (ACTION_VOLUME.equals(action) && player != null) {
            float volume = Math.max(0f, Math.min(1f, intent.getFloatExtra(EXTRA_VOLUME, 1f)));
            player.setVolume(volume, volume);
        } else if (ACTION_STOP.equals(action)) stopPlayback();
        return START_STICKY;
    }

    private void startPlayback(Intent intent) {
        String url = intent.getStringExtra(EXTRA_URL);
        if (url == null || url.isEmpty()) return;
        lastError = null;
        title = intent.getStringExtra(EXTRA_TITLE) != null ? intent.getStringExtra(EXTRA_TITLE) : "MusicWave";
        artist = intent.getStringExtra(EXTRA_ARTIST) != null ? intent.getStringExtra(EXTRA_ARTIST) : "Đang phát nhạc";
        stopPlayerOnly();
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
        } catch (Exception e) {
            Log.w("MusicWave", "startForeground fallback", e);
        }

        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            player.setDataSource(url);
            player.setOnPreparedListener(mediaPlayer -> {
                int position = intent.getIntExtra(EXTRA_POSITION, 0);
                if (position > 0) mediaPlayer.seekTo(position);
                float volume = Math.max(0f, Math.min(1f, intent.getFloatExtra(EXTRA_VOLUME, 1f)));
                mediaPlayer.setVolume(volume, volume);
                mediaPlayer.start();
                updateNotification();
            });
            player.setOnCompletionListener(mediaPlayer -> stopPlayback());
            player.setOnErrorListener((mediaPlayer, what, extra) -> {
                lastError = "Android không thể giải mã hoặc tải file audio (mã " + what + ").";
                Log.e("MusicWave", lastError + " extra=" + extra + " url=" + url);
                stopPlayback();
                return true;
            });
            player.prepareAsync();
        } catch (Exception error) {
            lastError = "Không thể mở URL audio: " + error.getMessage();
            Log.e("MusicWave", lastError, error);
            stopPlayback();
        }
    }

    private void pausePlayback() {
        if (player != null && player.isPlaying()) player.pause();
        updateNotification();
    }

    private void resumePlayback() {
        if (player != null) {
            try {
                player.start();
            } catch (IllegalStateException ignored) {}
        }
        updateNotification();
    }

    private void stopPlayback() {
        stopPlayerOnly();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void stopPlayerOnly() {
        if (player != null) {
            try {
                player.reset();
                player.release();
            } catch (Exception ignored) {}
            player = null;
        }
    }

    private Notification buildNotification() {
        createChannel();
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        boolean playing = player != null && player.isPlaying();
        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.musicwave.app.R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(playing ? artist : "Đã tạm dừng")
            .setContentIntent(contentIntent)
            .setOngoing(playing)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build();
    }

    private void updateNotification() {
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, buildNotification());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Phát nhạc nền", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Điều khiển phát nhạc nền MusicWave");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    public static int getPosition() {
        try {
            return player == null ? 0 : player.getCurrentPosition();
        } catch (Exception ignored) {
            return 0;
        }
    }

    public static int getDuration() {
        try {
            return player == null ? 0 : player.getDuration();
        } catch (Exception ignored) {
            return 0;
        }
    }

    public static boolean isPlaying() {
        try {
            return player != null && player.isPlaying();
        } catch (Exception ignored) {
            return false;
        }
    }

    public static String getLastError() {
        return lastError;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopPlayerOnly();
        super.onDestroy();
    }
}
