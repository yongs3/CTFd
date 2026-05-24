# Kangwon Cyber CTFd

[CTFd 3.8.5](https://github.com/CTFd/CTFd) 기반 강원 사이버 CTF 플랫폼.

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

### 5. 실행

```bash
docker compose up -d

# 첫 실행 후 whale 네트워크 설정
docker compose exec ctfd python manage.py set_config whale:auto_connect_network ctfd_containers
```

`http://localhost:8000`에서 CTFd 초기 설정 진행.

## 참고

- upstream: https://github.com/CTFd/CTFd
- whale 플러그인: https://github.com/frankli0324/ctfd-whale
- whale 설치 가이드: https://github.com/frankli0324/ctfd-whale/blob/master/docs/install.md
