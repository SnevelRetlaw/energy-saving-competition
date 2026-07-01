## Table `Participants`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `house_name` | `text` |  |
| `inhabitants` | `int2` |  Nullable |
| `score` | `int2` |  |
| `auth_user_id` | `uuid` | Primary |

## Table `Usage data`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `date` | `date` |  Nullable |
| `house_id` | `uuid` |  |
| `raw_elec_data` | `jsonb` |  Nullable |
| `raw_gas_data` | `jsonb` |  Nullable |

## Table `Challenges`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `title` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `start` | `date` |  Nullable |
| `end` | `date` |  Nullable |
| `challenge_progress_all_houses` | `json` |  Nullable |

## Table `SlimmemeterInfo`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `api_key` | `text` |  Nullable |
| `gas_id` | `text` |  Nullable |
| `elec_id` | `text` |  Nullable |
| `house_id` | `uuid` |  Nullable |

## Table `Daily energy insight`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `title` | `text` |  |
| `information` | `text` |  Nullable |
| `quiz` | `json` |  Nullable |
| `activity` | `text` |  Nullable |
| `date` | `date` |  Nullable |

## Table `Challenge progress`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `house_id` | `uuid` |  |
| `challenge_id` | `int8` |  |
| `challenge_progress` | `jsonb` |  Nullable |
| `completed` | `bool` |  |
| `points` | `int2` |  |

## Table `DEI progress`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `dei_id` | `int8` |  |
| `points` | `int2` |  |
| `given_answer` | `text` |  Nullable |
| `house_id` | `uuid` |  |
| `completed` | `bool` |  |

