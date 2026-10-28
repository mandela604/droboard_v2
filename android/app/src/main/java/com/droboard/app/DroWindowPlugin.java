package com.droboard.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiny app-only bridge: recolors the native window background, which is
 * what paints the strip above the WebView (the status bar itself) on
 * Android 15+ where the status-bar color API is blocked. Also aligns the
 * bottom system gesture bar and its button contrast. Website code never
 * sees this — web builds no-op via the isNative guard in app-nav.js.
 */
@CapacitorPlugin(name = "DroWindow")
public class DroWindowPlugin extends Plugin {

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        final String color = call.getString("color", "#FFFFFF");
        final int rgb;
        try {
            rgb = Color.parseColor(color);
        } catch (Exception e) {
            call.reject("invalid color: " + color);
            return;
        }
        getBridge().executeOnMainThread(() -> {
            try {
                getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(rgb));
                getActivity().getWindow().getDecorView().setBackgroundColor(rgb);
                boolean lightBg = ColorUtils.calculateLuminance(rgb) > 0.5;
                WindowInsetsControllerCompat ctrl = WindowCompat.getInsetsController(
                    getActivity().getWindow(),
                    getActivity().getWindow().getDecorView()
                );
                // Icon contrast follows the strip we just painted. This only
                // flips a flag — it changes no metrics.
                //
                // Deliberately NOT touching the navigation-bar color or its
                // appearance here: on Android 15+ that re-dispatches window
                // insets, which resizes the WebView, which reflows every
                // 100vh-based section on the page. Recoloring the strip must
                // never move the layout.
                ctrl.setAppearanceLightStatusBars(lightBg);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("color", color);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("setBackgroundColor failed", e);
            }
        });
    }
}
