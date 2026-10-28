package com.droboard.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must run BEFORE super.onCreate: the bridge (and its plugin list)
        // is created there — later registration would be ignored.
        registerPlugin(DroWindowPlugin.class);
        super.onCreate(savedInstanceState);
        // Default strip until the page reports its own theme: white, the same
        // as a light page (dark pages repaint it black within the first
        // frames). The window background is what paints the status-bar row,
        // because the WebView now starts below it (SystemBars insetsHandling
        // = "native").
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#FFFFFF")));
    }
}
