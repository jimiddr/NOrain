# 万象漫游 · Curiosity Roaming

**An interactive learning platform for primary-school children aged 10–12**

Live site: https://study.norain.uk *(login-walled, invite-only — see “Why this showcase exists” below)*

---

## What it is

Curiosity Roaming （万象漫游） is a guided, visual, interactive learning platform built for children aged 10–12. Instead of presenting mathematics and science as lists of drill questions, it takes learners on a 12-week journey in which every week is a themed unit, every day begins with exploration, and every answer is checked against a real underlying model — not just marked right or wrong.

The design is inspired by the interactive learning model of Brilliant.org: visual exploration first, guided reasoning second, formal answers last.

## Why this showcase exists

The live platform is intentionally closed: accounts are invite-only and all content sits behind a login, because its users are children. That means reviewers, collaborators, and grant assessors cannot browse the product directly. This public repository exists to describe the project, its pedagogy, and its research programme in the open.

- This repository contains **documentation only** — no source code.
- The full private source repository is **available to reviewers on request**.

## How learning works

- **A 12-week journey** — one unit per week, five days per week, with sequential unlocking as learners progress.
- **Explore before answering** — each topic opens with a visual, manipulable model (drag, rotate, simulate, observe) before any question is asked.
- **Solver-verified answers** — every exercise is backed by a solver that verifies a learner’s answer against the actual model. Shortcuts and guesses that bypass the reasoning **must fail**; only a genuinely correct result passes.
- **Guided, not punished** — hints are available, mistakes lead to support paths rather than dead ends, and each unit ends with a multi-stage “Boss” challenge that consolidates the week’s ideas.
- **Progress that is visible** — learners earn points for completed work, track their journey on a map, and travel with one of four companion characters who react to their progress and provide encouragement and small skill rewards.
- **Fixed, reproducible content** — exercises use fixed seeds and pre-solved challenges, so every learner’s experience is consistent and every question is known to be solvable.

## The 12 units

| Week | Unit | Theme |
|---|---|---|
| 1 | 把补给送到 · *Delivering the Supplies* | Space, motion and instructions |
| 2 | 水在跳舞 · *Dancing Water* | — |
| 3 | 会说话的光 · *Light That Speaks* | — |
| 4 | 会挑选的门 · *The Door That Chooses* | — |
| 5 | 量三次的绳 · *The Rope Measured Three Times* | — |
| 6 | 硬币的秘密 · *The Secret of the Coins* | — |
| 7 | 会说谎的图 · *The Chart That Lies* | — |
| 8 | 翻倍的魔法 · *Doubling Magic* | — |
| 9 | 三角的力量 · *The Power of Triangles* | — |
| 10 | 种子里的数 · *Numbers Hidden in Seeds* | — |
| 11 | 三步画万花 · *Spirograph in Three Steps* | — |
| 12 | 旧时的星光 · *Starlight from Long Ago* | — |

## Research programme

Curiosity Roaming is also the testbed for a research project on **human–AI interaction in children’s learning**, currently proposed to the OpenAI Researcher Access Program:

> **Interpretable AI explanations for young learners: how guided human-AI interaction affects conceptual understanding in an interactive primary-school learning platform**

**Research questions**

- Can AI-generated explanations that are interpretable to non-expert users (children aged 10–12) improve conceptual understanding and reduce persistent misconceptions, compared with static hints?
- How do different interface designs for human–AI interaction affect learners’ trust, persistence, and repeat-error rates?

**Planned use of AI APIs**

1. Generate and compare adaptive hint and explanation variants for the same problem, always grounded in the platform’s solver-verified answers, so an explanation can never contradict the verified result.
2. Classify learners’ errors into misconception categories and measure whether explanation style changes repeat-error rates.
3. Run multimodal experiments combining text explanations with the platform’s existing visual models and diagrams.
4. Publish aggregated, anonymised findings.

**Data protection and ethics**

- **No personally identifiable information about children is ever sent to an AI API.** Only anonymised, aggregated problem-and-response data is used.
- Every AI explanation is checked against a solver-verified answer before it can be shown to a learner.
- The platform is a closed, invite-only family learning project; accounts for children are created and supervised by their parents.

## Status

- Built and maintained by an **independent developer (Ji Liu)** as a family learning project.
- Week 1 content is live on the platform; the remaining units are in staged development following the same verified-exercise model.
- This showcase is maintained alongside the OpenAI Researcher Access Program application; the research is designed to be completed within 12 months of any credit grant.

---

## 中文简介

**万象漫游**是一个为 10–12 岁小学生打造的互动学习网站（https://study.norain.uk）。全站共 12 周、每周一个主题单元、每周 5 天：先通过可视化互动探索，再做由求解器验算的题目（走捷径必须失败），配有进度追踪、积分和伙伴角色，设计上对标 Brilliant.org 的互动学习模式。

网站因用户是儿童而采用邀请制登录墙，外部无法直接浏览，因此建立本公开仓库作项目说明：这里只有文档，没有源码；完整的私有源码仓库可应审核方要求提供。

本项目同时是一项关于“儿童学习中人机交互”的研究载体：研究 AI 生成的、能被非专家用户（儿童）理解的解释，是否能提升概念理解、减少重复错误。研究只使用匿名化、汇总后的数据，且所有 AI 解释在展示给孩子之前都必须与求解器验算的正确答案核对一致。

---

*Documentation-only showcase. No source code, credentials, or user data are contained in this repository.*
