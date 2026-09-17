import struct, os, collections

def sh(s):
    n1=n2=5381; i=0
    while i<len(s):
        n1=(((n1<<5)+n1)^ord(s[i]))&0xFFFFFFFF
        if i+1>=len(s): break
        n2=(((n2<<5)+n2)^ord(s[i+1]))&0xFFFFFFFF; i+=2
    return (n1+n2*1566083941)&0xFFFFFFFF

class R:
    def __init__(s,d,o=0): s.d=d; s.o=o
    def u8(s):  v=s.d[s.o]; s.o+=1; return v
    def u16(s): v=struct.unpack_from("<H",s.d,s.o)[0]; s.o+=2; return v
    def i16(s): v=struct.unpack_from("<h",s.d,s.o)[0]; s.o+=2; return v
    def i32(s): v=struct.unpack_from("<i",s.d,s.o)[0]; s.o+=4; return v
    def u32(s): v=struct.unpack_from("<I",s.d,s.o)[0]; s.o+=4; return v
    def i64(s): v=struct.unpack_from("<q",s.d,s.o)[0]; s.o+=8; return v
    def f32(s): v=struct.unpack_from("<f",s.d,s.o)[0]; s.o+=4; return v
    def v7(s):
        n=0; k=0
        while True:
            b=s.u8(); n|=(b&0x7F)<<k
            if not b&0x80: return n
            k+=7
    def str(s):
        n=s.v7(); v=s.d[s.o:s.o+n].decode("utf-8","replace"); s.o+=n; return v
    def bytes_(s):
        n=s.i32(); v=s.d[s.o:s.o+n]; s.o+=n; return v

F_CONN,F_FLOAT,F_VEC3,F_QUAT,F_INT,F_LONG,F_STR,F_BYTES = 0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80
H_ROT,H_PACKED = 0x1000,0x2000
KNOWN = 0xFF|H_ROT|H_PACKED|0x0100|0x0200|0x0400|0x0800

def parse_one(r):
    fl=r.u16(); lo=fl&0xFF
    z={"flags":fl}
    if fl&H_PACKED: x=r.i16(); zz=r.i16(); z["pos"]=(float(x),None,float(zz))
    else:           z["pos"]=(r.f32(),r.f32(),r.f32())
    z["prefab"]=r.u32()
    if fl&H_ROT:
        w=r.u16()
        if not (w & 0x8000):
            w2=r.u16(); z["rot"]=(w,w2); z["rot4"]=True
        else: z["rot"]=w
    if lo&F_CONN: z["conn"]=(r.u8(), r.u32())
    if lo&F_FLOAT: z["f"]={r.u32():r.f32() for _ in range(r.u8())}
    if lo&F_VEC3:  z["v"]={r.u32():(r.f32(),r.f32(),r.f32()) for _ in range(r.u8())}
    if lo&F_QUAT:  z["q"]={r.u32():(r.f32(),r.f32(),r.f32(),r.f32()) for _ in range(r.u8())}
    if lo&F_INT:   z["i"]={r.u32():r.i32() for _ in range(r.u8())}
    if lo&F_LONG:  z["l"]={r.u32():r.i64() for _ in range(r.u8())}
    if lo&F_STR:   z["s"]={r.u32():r.str() for _ in range(r.u8())}
    if lo&F_BYTES: z["b"]={r.u32():r.bytes_() for _ in range(r.u8())}
    if fl & ~KNOWN: z["_warn"]=f"{fl:04x}"
    return z

def parse_chunk(path, verbose=True):
    d=open(path,"rb").read(); r=R(d)
    ver=r.i16(); n=r.i32(); out=[]
    for k in range(n):
        start=r.o
        try:
            out.append(parse_one(r))
        except Exception as e:
            if verbose:
                print(f"CHYBA zaznam {k} @ {start}: {e}")
                print("  bytes:", d[start:start+72].hex(" "))
                if out:
                    p=out[-1]; print("  predchozi flags", f"{p['flags']:04x}", "prefab", f"{p['prefab']:08x}",
                                     {kk:len(v) for kk,v in p.items() if isinstance(v,dict)})
            raise
    return ver,n,out,r.o,len(d)

if __name__=="__main__":
    import sys
    ver,n,zs,end,size=parse_chunk(sys.argv[1])
    print(f"{os.path.basename(sys.argv[1])}: verze={ver} deklarovano={n} precteno={len(zs)} konec={end}/{size} {'OK' if end==size and len(zs)==n else 'NESEDI'}")
    w=collections.Counter(z["_warn"] for z in zs if "_warn" in z); print("neznamych flagu:", w.most_common(6))
    print("flagy top:", collections.Counter(f"{z['flags']:04x}" for z in zs).most_common(10))
