#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_PATH_LEN 1024

int has_flag(const char* arg, const char* flag) {
    return strcmp(arg, flag) == 0;
}

int main(int argc, char* argv[]) {
    int updated = 0;
    int force_run = 0;
    const char* target_version = "0.1.15";
    
    for (int i = 1; i < argc; i++) {
        if (has_flag(argv[i], "--updated")) {
            updated = 1;
        } else if (has_flag(argv[i], "--force-run")) {
            force_run = 1;
        }
    }
    
    if (!updated) {
        fprintf(stderr, "ERROR: expected --updated flag\n");
        return 1;
    }
    
    char app_dir[MAX_PATH_LEN];
    DWORD len = GetEnvironmentVariable("TDSH_APP_DIR", app_dir, MAX_PATH_LEN);
    if (len == 0 || len > MAX_PATH_LEN) {
        strcpy(app_dir, "G:\\dsh-desktop");
    }
    
    char pkg_path[MAX_PATH_LEN];
    snprintf(pkg_path, sizeof(pkg_path), "%s\\package.json", app_dir);
    
    FILE* f = fopen(pkg_path, "rb");
    if (!f) {
        fprintf(stderr, "ERROR: cannot open %s\n", pkg_path);
        return 1;
    }
    
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    
    char* content = (char*)malloc(size + 1);
    if (!content) {
        fprintf(stderr, "ERROR: malloc failed\n");
        fclose(f);
        return 1;
    }
    
    size_t read = fread(content, 1, size, f);
    fclose(f);
    
    if (read != (size_t)size) {
        fprintf(stderr, "ERROR: read failed\n");
        free(content);
        return 1;
    }
    content[size] = '\0';
    
    char search_old[64];
    char search_new[64];
    snprintf(search_old, sizeof(search_old), "\"version\": \"0.1.14\"");
    snprintf(search_new, sizeof(search_new), "\"version\": \"%s\"", target_version);
    
    char* pos = strstr(content, search_old);
    if (!pos) {
        fprintf(stderr, "ERROR: '%s' not found in %s\n", "0.1.14", pkg_path);
        free(content);
        return 1;
    }
    
    memcpy(pos, search_new, strlen(search_new));
    
    f = fopen(pkg_path, "wb");
    if (!f) {
        fprintf(stderr, "ERROR: cannot write %s\n", pkg_path);
        free(content);
        return 1;
    }
    
    size_t content_len = strlen(content);
    size_t written = fwrite(content, 1, content_len, f);
    fclose(f);
    free(content);
    
    if (written != content_len) {
        fprintf(stderr, "ERROR: write failed\n");
        return 1;
    }
    
    printf("OK: %s version set to %s\n", pkg_path, target_version);
    
    if (force_run) {
        char exe_path[MAX_PATH_LEN];
        char cmdline[MAX_PATH_LEN * 2];
        snprintf(exe_path, sizeof(exe_path), "%s\\node_modules\\.pnpm\\electron@33.0.0_supports-color@7.1.0\\node_modules\\electron\\dist\\electron.exe", app_dir);
        // 引号包裹 exe 路径 + app_dir 参数，避免路径含空格
        snprintf(cmdline, sizeof(cmdline), "\"%s\" \"%s\"", exe_path, app_dir);

        STARTUPINFO si = {0};
        PROCESS_INFORMATION pi = {0};
        si.cb = sizeof(si);

        // CreateProcess: lpApplicationName=NULL, lpCommandLine=可写缓冲区 cmdline，
        // 工作目录设为 app_dir（electron 在此找 package.json 作为 app root）
        if (CreateProcess(NULL, cmdline, NULL, NULL, FALSE, CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS, NULL, app_dir, &si, &pi)) {
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            printf("OK: launched electron in %s\n", app_dir);
        } else {
            fprintf(stderr, "WARN: failed to launch electron: error %lu\n", GetLastError());
        }
    }
    
    return 0;
}