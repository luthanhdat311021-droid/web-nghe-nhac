package com.musicwave.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {
    @Override public void load() { super.load(); }

    @PluginMethod public void play(PluginCall call) {
        Intent intent = new Intent(getContext(), MusicPlaybackService.class).setAction(MusicPlaybackService.ACTION_PLAY);
        intent.putExtra(MusicPlaybackService.EXTRA_URL, call.getString("url"));
        intent.putExtra(MusicPlaybackService.EXTRA_TITLE, call.getString("title", "MusicWave"));
        intent.putExtra(MusicPlaybackService.EXTRA_ARTIST, call.getString("artist", "Đang phát nhạc"));
        intent.putExtra(MusicPlaybackService.EXTRA_POSITION, call.getInt("position", 0));
        intent.putExtra(MusicPlaybackService.EXTRA_VOLUME, call.getFloat("volume", 1f));
        startService(intent, true);
        call.resolve();
    }

    @PluginMethod public void pause(PluginCall call) { startService(command(MusicPlaybackService.ACTION_PAUSE), false); call.resolve(); }
    @PluginMethod public void resume(PluginCall call) { startService(command(MusicPlaybackService.ACTION_RESUME), false); call.resolve(); }
    @PluginMethod public void stop(PluginCall call) { startService(command(MusicPlaybackService.ACTION_STOP), false); call.resolve(); }
    @PluginMethod public void seek(PluginCall call) { Intent intent = command(MusicPlaybackService.ACTION_SEEK); intent.putExtra(MusicPlaybackService.EXTRA_POSITION, call.getInt("position", 0)); startService(intent, false); call.resolve(); }
    @PluginMethod public void setVolume(PluginCall call) { Intent intent = command(MusicPlaybackService.ACTION_VOLUME); intent.putExtra(MusicPlaybackService.EXTRA_VOLUME, call.getFloat("volume", 1f)); startService(intent, false); call.resolve(); }
    @PluginMethod public void getState(PluginCall call) {
        com.getcapacitor.JSObject state = new com.getcapacitor.JSObject();
        state.put("isPlaying", MusicPlaybackService.isPlaying());
        state.put("position", MusicPlaybackService.getPosition() / 1000d);
        state.put("duration", MusicPlaybackService.getDuration() / 1000d);
        state.put("error", MusicPlaybackService.getLastError());
        call.resolve(state);
    }
    private Intent command(String action) { return new Intent(getContext(), MusicPlaybackService.class).setAction(action); }
    private void startService(Intent intent, boolean foreground) {
        if (foreground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
    }
}
