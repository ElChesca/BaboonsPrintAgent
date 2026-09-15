# tools/fiscal_simulator/fiscal_epson.py
"""
Driver del controlador fiscal EPSON TM-T900FA para el AGENTE LOCAL (Fase 2).
Emite un comprobante a partir de un 'job' de la cola fiscal y devuelve el Nº
que ASIGNA el equipo. Reusa el códec fiel fiscal_frame.

Transportes:
  - TCPTransport  : simulador y/o T900FA por Ethernet RAW (host:puerto).
  - SerialTransport: T900FA por USB/serie (pyserial). [requiere pyserial]
La interfaz Ethernet HTTP/HTTPS del equipo se agregará como HttpTransport.

⚠️ Los códigos de comando de comprobante son PROVISIONALES (confirmar contra el
manual del firmware real, Cap. 6). Centralizados acá para cambiarlos 1 sola vez.
"""
import socket
import itertools
from fiscal_frame import build_packet, parse_packet, extract_packet, u16, from_u16, NAK

# Códigos de comando (idénticos al simulador)
CMD_INFO     = (0x0002, 0x000A)   # verificado
CMD_ABRIR    = (0x0010, 0x0001)   # provisional
CMD_ITEM     = (0x0010, 0x0002)   # provisional
CMD_CERRAR   = (0x0010, 0x0003)   # provisional
CMD_CANCELAR = (0x0010, 0x0004)   # provisional

_seq = itertools.cycle(range(0x81, 0x100))


class FiscalError(Exception):
    pass


class TCPTransport:
    def __init__(self, host, port, timeout=8):
        self.host, self.port, self.timeout = host, port, timeout
        self.sock = None
    def open(self):
        self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
    def close(self):
        if self.sock:
            try: self.sock.close()
            finally: self.sock = None
    def send(self, data): self.sock.sendall(data)
    def recv(self, n=4096): return self.sock.recv(n)


class SerialTransport:
    """T900FA por USB/serie. Requiere pyserial (no usado en el simulador)."""
    def __init__(self, port, baud=9600, timeout=8):
        import serial  # lazy import
        self._serial = serial.Serial(port, baud, timeout=timeout)
    def open(self): pass
    def close(self): self._serial.close()
    def send(self, data): self._serial.write(data)
    def recv(self, n=4096): return self._serial.read(n) or b""


def transport_from_cfg(cfg):
    """cfg = {conexion:'red'|'usb', ip, puerto, dispositivo}."""
    if cfg.get('conexion') == 'red':
        return TCPTransport(cfg['ip'], int(cfg.get('puerto') or 9100))
    # usb
    return SerialTransport(cfg.get('dispositivo') or 'COM1')


class FiscalEpson:
    def __init__(self, transport):
        self.t = transport
    def __enter__(self):
        self.t.open(); return self
    def __exit__(self, *a):
        self.t.close()

    def _cmd(self, cmd, ext, *campos):
        seq = next(_seq)
        fields = [u16(cmd) + u16(ext)] + [c.encode() if isinstance(c, str) else c for c in campos]
        self.t.send(build_packet(seq, fields))
        ack = self.t.recv(1)
        if ack and ack[0] == NAK:
            raise FiscalError("El equipo respondió NAK (paquete rechazado)")
        pkt = self._read_packet()
        _seqr, fields = parse_packet(pkt)
        ret = from_u16(fields[0][4:6])
        return {'stat_printer': from_u16(fields[0][0:2]),
                'stat_fiscal': from_u16(fields[0][2:4]),
                'retorno': ret, 'extra': fields[1:]}

    def _read_packet(self):
        buf = bytearray()
        while True:
            b = self.t.recv(4096)
            if not b:
                raise FiscalError("Conexión cerrada por el equipo")
            buf += b
            pkt, _rest = extract_packet(bytes(buf))
            if pkt is not None:
                return pkt

    def info(self):
        r = self._cmd(*CMD_INFO)
        return [x.decode(errors='ignore') for x in r['extra']]

    def emitir(self, job):
        """
        job = {tipo_comprobante:'A'|'B', payload:{items:[{desc,cant,precio}], receptor?}}
        Devuelve el nro de comprobante asignado por el equipo.
        """
        tipo = (job.get('tipo_comprobante') or 'B').upper()
        payload = job.get('payload') or {}
        items = payload.get('items') or []
        if not items:
            raise FiscalError("El comprobante no tiene ítems")
        r = self._cmd(*CMD_ABRIR, tipo)
        if r['retorno'] != 0:
            raise FiscalError("No se pudo abrir el comprobante (retorno %d)" % r['retorno'])
        try:
            for it in items:
                desc = str(it.get('desc') or it.get('nombre') or 'ITEM')
                cant = str(it.get('cant') or it.get('cantidad') or 1)
                precio = str(it.get('precio') or it.get('precio_unitario') or 0)
                r = self._cmd(*CMD_ITEM, desc, cant, precio)
                if r['retorno'] != 0:
                    raise FiscalError("Ítem rechazado: %s (retorno %d)" % (desc, r['retorno']))
            r = self._cmd(*CMD_CERRAR)
            if r['retorno'] != 0 or not r['extra']:
                raise FiscalError("No se pudo cerrar el comprobante (retorno %d)" % r['retorno'])
            return r['extra'][0].decode()
        except Exception:
            try: self._cmd(*CMD_CANCELAR)
            except Exception: pass
            raise


def emitir_job(cfg, job):
    """Helper de alto nivel: abre transporte, emite y devuelve el nro."""
    with FiscalEpson(transport_from_cfg(cfg)) as fe:
        return fe.emitir(job)
