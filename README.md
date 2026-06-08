# Kangwon Cyber CTFd

[CTFd 3.8.5](https://github.com/CTFd/CTFd) 기반 강원 사이버 CTF 플랫폼.

## 아키텍처

로컬 서버에서 전체 스택 실행, 클라우드는 공인 IP 제공용 리버스 프록시만 담당.

```
   학생 (브라우저)
       |
       | HTTP
       v
+----------------------------+
| 클라우드 (리버스 프록시)     |
|                            |
| iptables DNAT              |
|  :80 :8080 :10000-10100    |
|  → 로컬 서버 Tailscale IP   |
+------------|---------------+
             | Tailscale (암호화 터널)
             v
+----------------------------+
| 로컬 서버                   |
|                            |
| nginx :80 --> CTFd :8000   |
| nginx :8888 (LLM API 프록시)|
|                            |
| MariaDB  Redis             |
| frps :8080  frpc :7400     |
|   :10000-10100             |
|                            |
| Docker Swarm (단일 노드)    |
| 챌린지 컨테이너 (학생별)     |
+----------------------------+
```

### 흐름

1. 학생이 CTFd에서 챌린지 Launch 클릭
2. whale 플러그인이 Docker Swarm API로 컨테이너 생성
3. 컨테이너가 로컬 서버의 `linux-1` 노드에 배치
4. 컨테이너에 학생별 고유 FLAG 환경변수 주입
5. frpc가 해당 컨테이너로의 터널 자동 등록
6. 학생에게 접속 정보 표시 (TCP: `:100xx` / HTTP: 서브도메인)
7. 학생은 클라우드 공인 IP로 접속 → iptables DNAT → Tailscale → 로컬 서버
8. 시간 만료 시 컨테이너 자동 삭제

### 구성 요소

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| iptables DNAT | 클라우드 | 공인 IP → 로컬 서버 트래픽 포워딩 |
| Tailscale | 양쪽 | 클라우드 ↔ 로컬 암호화 VPN |
| CTFd | 로컬 서버 | 웹 플랫폼, 문제 관리, 스코어보드 |
| MariaDB | 로컬 서버 | CTFd 데이터베이스 |
| Redis | 로컬 서버 | 캐시 (whale 필수) |
| nginx | 로컬 서버 | CTFd 리버스 프록시 (:80) + LLM API 프록시 (:8888) |
| frps | 로컬 서버 | 챌린지 트래픽 게이트웨이 |
| frpc | 로컬 서버 | 챌린지 컨테이너 ↔ frps 터널 중계 |
| Docker Swarm | 로컬 서버 | 단일 노드 (매니저+워커) |
| 챌린지 컨테이너 | 로컬 서버 | 학생별 독립 환경 (동적 생성/삭제) |

## upstream 대비 변경사항

### 커스텀 테마

`CTFd/themes/kangwon-cyber/` 디렉토리에 전용 테마 추가. upstream `core` 테마는 수정하지 않음.

CTFd 설정에서 테마를 `kangwon-cyber`로 선택하면 적용됨.

### 한국어 번역 보완

- 스코어보드 "Place" 번역 수정: 장소 → 순위
- 팀 생성 안내 문구 한국어 번역 추가

### ctfd-whale 플러그인 연동

[ctfd-whale fork](https://github.com/yongs3/ctfd-whale)을 통해 학생별 독립 챌린지 컨테이너를 동적 생성.

`docker-compose.yml`에 frpc/frps 서비스, overlay 네트워크, Docker 소켓 마운트가 포함되어 있음.

### docker-compose.yml 주요 수정

| 항목 | upstream | 이 fork |
|---|---|---|
| `build.network` | (기본값) | `host` (BuildKit DNS 문제 방지) |
| `ctfd.user` | `1001` | `root` (Docker 소켓 접근) |
| Docker socket | 없음 | `/var/run/docker.sock` 마운트 |
| frpc / frps | 없음 | 추가 (whale 연동) |
| overlay 네트워크 | 없음 | `frp`, `containers` 추가 |
| nginx LLM 프록시 | 없음 | `:8888` (챌린지 컨테이너 → 외부 LLM API) |
| nginx containers 네트워크 | 없음 | 챌린지 전용 네트워크에서 nginx 접근 가능 |
| 환경변수 | 없음 | `FRP_TOKEN`, `FRP_SUBDOMAIN_HOST` |

## 배포 방법

### 1. 클론

```bash
git clone https://github.com/yongs3/CTFd.git
cd CTFd
```

### 2. whale 플러그인 설치

```bash
git clone --depth 1 https://github.com/yongs3/ctfd-whale.git CTFd/plugins/ctfd-whale
```

### 3. 환경 설정

```bash
cp .env.example .env
# .env 편집: FRP_TOKEN, FRP_SUBDOMAIN_HOST 설정
```

### 4. Docker Swarm 초기화 (단일 노드)

```bash
docker swarm init
docker node update --label-add name=linux-1 $(docker node ls -q)
```

### 5. 실행

```bash
docker compose up -d --build
```

`http://localhost`에서 CTFd 초기 설정 진행.

### 5-1. whale 플러그인 설정 (첫 실행 후)

> **주의**: whale의 config 키에는 `docker_` 접두사가 필요합니다.
> `whale:auto_connect_network`가 아니라 `whale:docker_auto_connect_network`입니다.
> 잘못된 키를 쓰면 챌린지 컨테이너가 frpc와 다른 네트워크에 배치되어 접속이 안 됩니다.

```bash
# 네트워크 설정 (단일 컨테이너 챌린지용)
docker compose exec ctfd python manage.py set_config whale:docker_auto_connect_network ctfd_containers

# 그룹 컨테이너 챌린지용 (JSON 이미지 {"web": "...", "eval": "..."} 사용 시 필수)
# whale이 챌린지마다 전용 overlay 네트워크를 만들고 여기 지정된 컨테이너를 연결합니다.
# - frpc: 트래픽 라우팅용 (필수)
# - nginx: LLM 프록시 등 내부 서비스 접근이 필요한 챌린지용
# 컨테이너 이름은 docker compose ps로 확인 (기본: ctfd-frpc-1, ctfd-nginx-1)
docker compose exec ctfd python manage.py set_config whale:docker_auto_connect_containers ctfd-frpc-1,ctfd-nginx-1

# frp 연동
docker compose exec ctfd python manage.py set_config whale:frp_api_url http://frpc:7400
docker compose exec ctfd python manage.py set_config whale:frp_http_domain_suffix <공인IP>.nip.io
docker compose exec ctfd python manage.py set_config whale:frp_http_port 8080
docker compose exec ctfd python manage.py set_config whale:frp_direct_ip_address <공인IP>
docker compose exec ctfd python manage.py set_config whale:frp_direct_port_minimum 10000
docker compose exec ctfd python manage.py set_config whale:frp_direct_port_maximum 10100

# 플래그 템플릿 (원하는 형식으로)
docker compose exec ctfd python manage.py set_config 'whale:template_chall_flag' '{{ "GA{" + uuid.uuid4()|string + "}" }}'
```

### 6. 클라우드 리버스 프록시 설정

클라우드 서버에서 iptables DNAT으로 트래픽을 로컬 서버 Tailscale IP로 포워딩:

```bash
# IP 포워딩 활성화
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-forward.conf

# DNAT: 클라우드 공인 IP → 로컬 서버 Tailscale IP
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination <로컬_TAILSCALE_IP>
sudo iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination <로컬_TAILSCALE_IP>
sudo iptables -t nat -A PREROUTING -p tcp --dport 10000:10100 -j DNAT --to-destination <로컬_TAILSCALE_IP>
sudo iptables -t nat -A POSTROUTING -j MASQUERADE

# 영구 저장
sudo iptables-save | sudo tee /etc/iptables.rules
```

### 7. 챌린지 추가

1. 챌린지 Docker 이미지 준비
   - 환경변수 `$FLAG`로 플래그가 주입됨
   - entrypoint에서 `echo "$FLAG" > /flag` 등으로 배치
   - `${FLAG:-default}` 형태에서 default에 `{}`가 포함되면 bash 파싱 오류 주의
2. 로컬 서버에서 이미지 빌드
3. CTFd Admin > Challenges > New > `dynamic_docker` 타입 선택
4. 이미지명, 포트, 접속 방식(http/direct) 설정
5. Flag 필드는 **비워두기** (whale이 학생별 고유 플래그 자동 생성)

### 챌린지 이미지 설정 예시 (그룹 컨테이너)

| 필드 | 값 | 설명 |
|---|---|---|
| Docker Image | `{"web": "my-chall-web:v1", "eval": "my-chall-eval:v1"}` | JSON 형식, 첫 번째 키가 메인 |
| Frp Redirect Type | `HTTP` 또는 `direct` | 웹이면 HTTP, TCP면 direct |
| Frp Redirect Port | `8000` | 메인 컨테이너의 expose 포트 |
| Memory Limit | `256m` | 챌린지에 따라 조정 |
| CPU Limit | `0.5` | |
| Flag | (비워두기) | whale이 자동 생성 |

### 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| frps "page not found" | frpc가 챌린지 컨테이너 DNS 해석 못 함 | `whale:docker_auto_connect_containers`에 `ctfd-frpc-1` 확인 |
| "Unable to access frpc admin api" | frpc admin 포트 불일치 | compose의 `--admin_port`와 `whale:frp_api_url` 포트 일치 확인 |
| "Unable to connect to Docker API" | docker SDK 버전 문제 | whale의 `requirements.txt`에서 `docker>=7.0.0,<8` 확인 |
| 챌린지에서 외부 API 접속 불가 | `containers` 네트워크가 `internal: true` | nginx LLM 프록시 사용, `docker_auto_connect_containers`에 `ctfd-nginx-1` 추가 |
| 플래그 끝에 `}}` 이중 괄호 | entrypoint에서 `${FLAG:-default{}}` bash 파싱 오류 | `echo "$FLAG" > /flag` 사용 (기본값에 `{}` 포함 금지) |
| BuildKit에서 pip 설치 실패 | Docker 빌드 DNS 해석 불가 | `build.network: host` 설정 확인 |

## 참고

- upstream: https://github.com/CTFd/CTFd
- whale 플러그인: https://github.com/yongs3/ctfd-whale
- whale 설치 가이드: https://github.com/yongs3/ctfd-whale/blob/master/docs/install.md
