# tools/fiscal_simulator/fiscal_frame.py
"""Codec del Protocolo Extendido EPSON (Serial/USB) - TM-T900FA (firmware Ceres, Cap. 4).

Paquete:   STX  Seq  <frame de datos>  ETX  Checksum
  STX=0x02 ETX=0x03 ESC=0x1B FLD=0x1C (separador de campos)
  Seq: 0x81..0xFF (host). 0x80 = respuesta intermedia.
  Checksum: 4 chars ASCII hex de la suma (2 bytes) de STX..ETX inclusive.
  Escape: byte de DATO en {02,03,1A,1B,1C,1D,1E,1F} va precedido de 0x1B.
Frame COMANDO:   Command(2) CmdExt(2) [FLD Campo]...
Frame RESPUESTA: StatPrinter(2) StatFiscal(2) Retorno(2) [FLD Campo]...  (Retorno 0 = OK)
"""

STX = 0x02
ETX = 0x03
ESC = 0x1B
FLD = 0x1C
ACK = 0x06
NAK = 0x15

_ESCAPE_SET = {0x02, 0x03, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F}


def _escape(data):
    out = bytearray()
    for b in data:
        if b in _ESCAPE_SET:
            out.append(ESC)
        out.append(b)
    return bytes(out)


def _unescape(data):
    out = bytearray()
    i = 0
    while i < len(data):
        if data[i] == ESC and i + 1 < len(data):
            out.append(data[i + 1]); i += 2
        else:
            out.append(data[i]); i += 1
    return bytes(out)


def _checksum(packet_wo_cs):
    s = sum(packet_wo_cs) & 0xFFFF
    return ("%04X" % s).encode("ascii")


def u16(n):
    return bytes([(n >> 8) & 0xFF, n & 0xFF])


def from_u16(b):
    return (b[0] << 8) | b[1]


def build_packet(seq, frame_fields):
    body = bytearray()
    body.append(STX)
    body.append(seq & 0xFF)
    for idx, f in enumerate(frame_fields):
        if idx > 0:
            body.append(FLD)
        body += _escape(f)
    body.append(ETX)
    return bytes(body) + _checksum(bytes(body))


def parse_packet(packet):
    if len(packet) < 7 or packet[0] != STX:
        raise ValueError("Paquete sin STX")
    body = packet[:-4]
    if body[-1] != ETX:
        raise ValueError("Paquete sin ETX final")
    if packet[-4:] != _checksum(body):
        raise ValueError("Checksum invalido")
    seq = body[1]
    raw = body[2:-1]
    fields, cur, i = [], bytearray(), 0
    while i < len(raw):
        if raw[i] == ESC and i + 1 < len(raw):
            cur.append(raw[i]); cur.append(raw[i + 1]); i += 2; continue
        if raw[i] == FLD:
            fields.append(_unescape(bytes(cur))); cur = bytearray(); i += 1; continue
        cur.append(raw[i]); i += 1
    fields.append(_unescape(bytes(cur)))
    return seq, fields


def extract_packet(buf):
    i = buf.find(STX)
    if i < 0:
        return None, b""
    j = i + 2
    while j < len(buf):
        if buf[j] == ESC:
            j += 2; continue
        if buf[j] == ETX:
            if len(buf) >= j + 5:
                return bytes(buf[i:j + 5]), bytes(buf[j + 5:])
            return None, bytes(buf[i:])
        j += 1
    return None, bytes(buf[i:])


def build_intermediate():
    body = bytes([STX, 0x80, ETX])
    return body + _checksum(body)
