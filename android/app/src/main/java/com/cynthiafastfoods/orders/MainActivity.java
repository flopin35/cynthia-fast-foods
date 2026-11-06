package com.cynthiafastfoods.orders;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Cynthia Orders: opens the live orders app full screen.
 * Phone calls, WhatsApp and any other site open in their own apps.
 */
public class MainActivity extends Activity {

    private static final String HOST = "cynthia-fast-foods.vercel.app";
    private static final String HOME = "https://" + HOST + "/app/";
    private static final String OFFLINE_PAGE =
        "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
        + "<body style='margin:0;font-family:sans-serif;background:#0E5A3A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
        + "<div style='padding:24px'><div style='font-size:48px'>&#128246;</div>"
        + "<h2 style='margin:12px 0 8px'>No internet connection</h2>"
        + "<p style='opacity:.85;margin:0 0 20px'>Connect to the internet to open your orders for the first time.</p>"
        + "<a href='" + HOME + "' style='display:inline-block;background:#F5B72A;color:#083A26;font-weight:bold;padding:14px 26px;border-radius:14px;text-decoration:none'>Try again</a>"
        + "</div></body></html>";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0E5A3A"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " CynthiaOrdersApp/1");
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath() == null ? "" : url.getPath();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost()) && path.startsWith("/app")) {
                    return false; // stay inside the app
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // no app on the phone can open this link
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(HOME, OFFLINE_PAGE, "text/html", "utf-8", null);
                }
            }
        });

        setContentView(web);
        if (state != null) {
            web.restoreState(state);
        } else {
            web.loadUrl(HOME);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
