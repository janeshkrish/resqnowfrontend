package com.resqnow1.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.View;

/**
 * The ring around the job on the locked-phone offer: it empties at a steady pace until the
 * offer runs out. Linear on purpose: it is a clock, not a decoration.
 */
public class CountdownRingView extends View {

    private final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint run = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF bounds = new RectF();
    private long startedAt = 0L;
    private long endsAt = 0L;

    public CountdownRingView(Context context, AttributeSet attrs) {
        super(context, attrs);
        float stroke = getResources().getDisplayMetrics().density * 10f;
        track.setStyle(Paint.Style.STROKE);
        track.setStrokeWidth(stroke);
        track.setColor(0xFFE9EBF1);
        run.setStyle(Paint.Style.STROKE);
        run.setStrokeWidth(stroke);
        run.setStrokeCap(Paint.Cap.ROUND);
        run.setColor(0xFFB01F2A);
    }

    /** Runs from now until {@code endsAtElapsed} (on the SystemClock.elapsedRealtime clock). */
    public void start(long endsAtElapsed) {
        startedAt = SystemClock.elapsedRealtime();
        endsAt = Math.max(startedAt + 1000L, endsAtElapsed);
        invalidate();
    }

    public void freeze() {
        endsAt = 0L;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float inset = track.getStrokeWidth() / 2f + 1f;
        bounds.set(inset, inset, getWidth() - inset, getHeight() - inset);
        canvas.drawArc(bounds, 0, 360, false, track);
        if (endsAt <= 0L) return;
        long now = SystemClock.elapsedRealtime();
        float left = Math.max(0f, Math.min(1f, (endsAt - now) / (float) (endsAt - startedAt)));
        if (left > 0f) canvas.drawArc(bounds, -90f, 360f * left, false, run);
        if (now < endsAt) postInvalidateOnAnimation();
    }
}
