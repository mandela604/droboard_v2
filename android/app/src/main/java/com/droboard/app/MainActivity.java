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
        // Default strip until the page reports its own theme: warm cream
        // (also when the phone is in dark mode), so the dark status bar
        // icons are always readable.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#F9EDE3")));
    }
}
