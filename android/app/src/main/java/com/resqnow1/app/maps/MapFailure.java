package com.resqnow1.app.maps;

final class MapFailure extends RuntimeException {
    final String code;
    MapFailure(String code) { super("Native map operation failed (" + code + ")."); this.code = code; }
}
