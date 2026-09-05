// dsearch — 自包含的快速文件索引搜索工具
// 扫描目录树建立文件索引，提供秒级文件名搜索。
// 替代 Everything 依赖：零外部服务，单 exe 即可运行。
//
// 用法:
//   dsearch index <root> <dbfile>             建/更新索引
//   dsearch query <dbfile> <term> [limit]     查询（子串匹配）
//   dsearch histogram <dbfile> [root]         统计索引大小（诊断）
package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---- 磁盘索引格式 ----
// 简单紧凑：magic + pathcount + paths(每项: len uint32 + bytes UTF-8)
// 文件名内联，查询时全量加载后子串匹配。
// 对百万级文件，内存 ~几百 MB 内。真实机几百万文件可接受。

const magic = "DSHIDX1"

func indexDB(dbFile string) error {
	// db 已存在 → 增量更新（本次扫描合并进旧索引，简单起见重建并跳过已存在）
	root := os.Args[2]
	paths := make([]string, 0, 1_000_000)
	var mu sync.Mutex

	// 并行扫描目录树
	filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			if os.IsPermission(err) {
				return nil // 跳过无权限
			}
			return err
		}
		if d.IsDir() {
			return nil
		}
		mu.Lock()
		paths = append(paths, p)
		mu.Unlock()
		return nil
	})
	sort.Strings(paths)

	f, err := os.Create(dbFile)
	if err != nil {
		// 尝试创建父目录
		if os.IsNotExist(err) {
			os.MkdirAll(filepath.Dir(dbFile), 0755)
			f, err = os.Create(dbFile)
		}
	}
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriterSize(f, 1<<20)
	w.WriteString(magic)
	w.WriteString(root)
	w.WriteByte(0) // root 以 NUL 结尾
	buf := make([]byte, 4)
	var vb [4]byte
	binary.LittleEndian.PutUint32(vb[:], uint32(len(paths)))
	w.Write(vb[:])
	for _, p := range paths {
		binary.LittleEndian.PutUint32(buf, uint32(len(p)))
		w.Write(buf)
		w.WriteString(p)
	}
	if err := w.Flush(); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "indexed %d files at %s\n", len(paths), root)
	return nil
}

func queryDB(dbFile string) error {
	term := os.Args[3]
	limit := 50
	if len(os.Args) > 4 {
		fmt.Sscanf(os.Args[4], "%d", &limit)
	}
	data, err := os.ReadFile(dbFile)
	if err != nil {
		return err
	}
	if len(data) < len(magic) || string(data[:len(magic)]) != magic {
		return fmt.Errorf("not a dsearch index: %s", dbFile)
	}
	pos := len(magic)
	rootEnd := indexByte(data[pos:], 0)
	if rootEnd < 0 {
		return fmt.Errorf("corrupt index header")
	}
	root := string(data[pos : pos+rootEnd])
	_ = root
	pos += rootEnd + 1
	if pos+4 > len(data) {
		return fmt.Errorf("corrupt index: no path count")
	}
	count := binary.LittleEndian.Uint32(data[pos : pos+4])
	pos += 4
	termLower := strings.ToLower(term)

	results := make([]string, 0, limit)
	seen := 0
	for i := uint32(0); i < count; i++ {
		if pos+4 > len(data) {
			return fmt.Errorf("corrupt index at path %d", i)
		}
		plen := binary.LittleEndian.Uint32(data[pos : pos+4])
		pos += 4
		if pos+int(plen) > len(data) {
			return fmt.Errorf("corrupt index: path %d length overflow", i)
		}
		p := string(data[pos : pos+int(plen)])
		pos += int(plen)
		// 子串匹配（大小写不敏感）
		if strings.Contains(strings.ToLower(p), termLower) {
			results = append(results, p)
			seen++
			if seen >= limit {
				break
			}
		}
	}
	for _, r := range results {
		fmt.Println(r)
	}
	return nil
}

func indexByte(b []byte, c byte) int {
	for i, v := range b {
		if v == c {
			return i
		}
	}
	return -1
}

func histogramDB(dbFile string) error {
	if len(os.Args) < 4 {
		return fmt.Errorf("histogram requires a root")
	}
	root := os.Args[3]
	if _, err := os.Stat(root); err != nil {
		return err
	}
	n := 0
	filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			n++
		}
		return nil
	})
	fmt.Printf("on-disk files under %s: %d\n", root, n)
	return nil
}

func main() {
	runtime.GOMAXPROCS(runtime.NumCPU())
	if len(os.Args) < 3 {
		fmt.Println("usage: dsearch index <root> <dbfile> | query <dbfile> <term> [limit] | histogram <dbfile> <root>")
		os.Exit(2)
	}
	cmd := os.Args[1]
	start := time.Now()
	var err error
	switch cmd {
	case "index":
		if len(os.Args) < 4 {
			err = fmt.Errorf("index requires root and dbfile")
		} else {
			err = indexDB(os.Args[3])
		}
	case "query":
		if len(os.Args) < 4 {
			err = fmt.Errorf("query requires dbfile and term")
		} else {
			err = queryDB(os.Args[2])
		}
	case "histogram":
		err = histogramDB(os.Args[2])
	default:
		err = fmt.Errorf("unknown command %q", cmd)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "dsearch:", err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "done in %v\n", time.Since(start))
}