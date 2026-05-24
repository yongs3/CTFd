# Kangwon Cyber CTFd

[CTFd 3.8.5](https://github.com/CTFd/CTFd) 기반 강원 사이버 CTF 플랫폼.

## 아키텍처

로컬 서버(14900KF)에서 전체 스택 실행, 클라우드는 공인 IP 제공용 리버스 프록시만 담당.

```
   학생 (브라우저)
       |
       | HTTP
       v
+----------------------------+
| 클라우드 (리버스 프록시)     |
|                            |
| nginx :80   --> :80        |
| nginx :8080 --> :8080      |
| iptables :10000-10100      |
|        --> :10000-10100    |
+------------|---------------+
             | Tailscale (암호화 터널)
             v
+----------------------------+
| 로컬 서버 (14900KF/64GB)   |
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
7. 학생은 클라우드 공인 IP로 접속 → Tailscale 터널 → 로컬 서버
8. 시간 만료 시 컨테이너 자동 삭제

### 구성 요소

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| nginx (프록시) | 클라우드 | 공인 IP → 로컬 서버 트래픽 포워딩 |
| Tailscale | 양쪽 | 클라우드 ↔ 로컬 암호화 VPN |
| CTFd | 로컬 서버 | 웹 플랫폼, 문제 관리, 스코어보드 |
| MariaDB | 로컬 서버 | CTFd 데이터베이스 |
| Redis | 로컬 서버 | 캐시 (whale 필수) |
| nginx (로컬) | 로컬 서버 | CTFd 리버스 프록시 + LLM API 프록시 |
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

[ctfd-whale (frankli0324)](https://github.com/frankli0324/ctfd-whale)을 통해 학생별 독립 챌린지 컨테이너를 동적 생성.

`docker-compose.yml`에 frpc/frps 서비스, overlay 네트워크, Docker 소켓 마운트가 포함되어 있음.

### docker-compose.yml 주요 수정

| 항목 | upstream | 이 fork |
|---|---|---|
| `build.network` | (기본값) | `host` (BuildKit DNS 문제 방지) |
| `ctfd.user` | `1001` | `root` (Docker 소켓 접근) |
| Docker socket | 없음 | `/var/run/docker.sock` 마운트 |
| frpc / frps | 없음 | 추가 (whale 연동) |
| overlay 네트워크 | 없음 | `frp`, `containers` 추가 |
| nginx LLM 프록시 | 없음 | `:8888` → litellm.yongs.win |
| 환경변수 | 없음 | `FRP_TOKEN`, `FRP_SUBDOMAIN_HOST` |

## 배포 방법

### 1. 클론

```bash
git clone https://github.com/yongs3/CTFd.git
cd CTFd
```

### 2. whale 플러그인 설치

```bash
git clone --depth 1 https://github.com/frankli0324/ctfd-whale.git CTFd/plugins/ctfd-whale

# docker SDK 버전 수정 (upstream이 4.1.0을 핀하고 있어 urllib3 2.x와 호환 안 됨)
sed -i 's/docker==4.1.0/docker>=7.0.0/' CTFd/plugins/ctfd-whale/requirements.txt
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

> **주의**: 키 이름에 `docker_` 접두사가 필요합니다. `whale:auto_connect_network`가 아니라
> `whale:docker_auto_connect_network`입니다. 잘못된 키를 쓰면 챌린지 컨테이너가 frpc와
> 다른 네트워크에 배치되어 접속이 안 됩니다.

```bash
# 필수
docker compose exec ctfd python manage.py set_config whale:docker_auto_connect_network ctfd_containers

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

클라우드 서버에 nginx + iptables로 트래픽 포워딩:

```bash
# nginx: HTTP 프록시 (:80, :8080 → 로컬 Tailscale IP)
# iptables: TCP 포워딩 (:10000-10100 → 로컬 Tailscale IP)
```

### 7. 챌린지 추가

1. 챌린지 Docker 이미지 준비 (환경변수 `$FLAG`로 플래그 주입)
2. 로컬 서버에서 이미지 빌드
3. CTFd Admin > Challenges > New > `dynamic_docker` 타입 선택
4. 이미지명, 포트, 접속 방식(http/direct) 설정

## 참고

- upstream: https://github.com/CTFd/CTFd
- whale 플러그인: https://github.com/frankli0324/ctfd-whale
- whale 설치 가이드: https://github.com/frankli0324/ctfd-whale/blob/master/docs/install.md
