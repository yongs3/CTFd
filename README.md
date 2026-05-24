# Kangwon Cyber CTFd

[CTFd 3.8.5](https://github.com/CTFd/CTFd) 기반 강원 사이버 CTF 플랫폼.

## 아키텍처

클라우드(CTFd 웹) + 로컬 서버(챌린지 컨테이너) 하이브리드 구성.

```
   학생 (브라우저)
       |
       | HTTP :80
       v
+--------------------------------------+
|  클라우드 (Swarm Manager)             |
|                                      |
|  nginx :80 --> CTFd :8000            |
|                  |                   |
|            Docker Socket             |
|                  v                   |
|             Swarm API                |
|                  |                   |
|  MariaDB   Redis   frps   frpc      |
|                    :8080   :7400     |
|                    :10000-10100      |
+---------|------------|---------------+
          |  Tailscale (암호화 터널)
          |  overlay network (ctfd_containers)
          |            |
+---------|------------|---------------+
|                      v               |
|       챌린지 컨테이너 (학생별 독립)    |
|       web-chall-1, pwn-chall-2 ...   |
|                                      |
|  로컬 서버 (Swarm Worker: linux-1)    |
+--------------------------------------+
```

### 흐름

1. 학생이 CTFd에서 챌린지 Launch 클릭
2. whale 플러그인이 Swarm API로 컨테이너 생성 요청
3. Swarm이 `linux-1` 라벨 워커(로컬 서버)에 컨테이너 배치
4. 컨테이너에 학생별 고유 FLAG 환경변수 주입
5. frpc가 해당 컨테이너로의 터널 자동 등록
6. 학생에게 접속 정보 표시 (TCP: `:100xx` / HTTP: 서브도메인)
7. 시간 만료 시 컨테이너 자동 삭제

### 구성 요소

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| CTFd | 클라우드 | 웹 플랫폼, 문제 관리, 스코어보드 |
| MariaDB | 클라우드 | CTFd 데이터베이스 |
| Redis | 클라우드 | 캐시 (whale 필수) |
| nginx | 클라우드 | 리버스 프록시 (:80 -> :8000) |
| frps | 클라우드 | 챌린지 트래픽 게이트웨이 |
| frpc | 클라우드 | 챌린지 컨테이너 ↔ frps 터널 중계 |
| Docker Swarm | 양쪽 | 클라우드=매니저, 로컬=워커 |
| Tailscale | 양쪽 | 클라우드 ↔ 로컬 암호화 VPN |
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

### 4. Docker Swarm 초기화

```bash
docker swarm init
docker node update --label-add name=linux-1 $(docker node ls -q)
```

원격 워커 노드 추가 시:
```bash
# 매니저에서 토큰 확인
docker swarm join-token worker

# 워커에서 조인 (Tailscale IP 사용)
docker swarm join --token <TOKEN> <MANAGER_TAILSCALE_IP>:2377
docker node update --label-add name=linux-1 <NODE_ID>
```

### 5. 실행

```bash
docker compose up -d

# 첫 실행 후 whale 네트워크 설정
docker compose exec ctfd python manage.py set_config whale:auto_connect_network ctfd_containers
```

`http://localhost`에서 CTFd 초기 설정 진행.

### 6. 챌린지 추가

1. 챌린지 Docker 이미지 준비 (환경변수 `$FLAG`로 플래그 주입)
2. 워커 노드에 이미지 빌드 또는 pull
3. CTFd Admin > Challenges > New > `dynamic_docker` 타입 선택
4. 이미지명, 포트, 접속 방식(http/direct) 설정

## 참고

- upstream: https://github.com/CTFd/CTFd
- whale 플러그인: https://github.com/frankli0324/ctfd-whale
- whale 설치 가이드: https://github.com/frankli0324/ctfd-whale/blob/master/docs/install.md
