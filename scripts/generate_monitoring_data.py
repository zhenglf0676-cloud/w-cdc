#!/usr/bin/env python3
"""生成 5 个企业 7.20-7.23 的监测数据 Excel 文件"""

import openpyxl
from openpyxl import Workbook
from datetime import datetime, timedelta
import random
import uuid

# 企业数据
enterprises = [
    {
        "name": "重庆大学",
        "outlets": ["cqu-1", "cqu-2"],
        "pollutants": [
            {"type": "pH", "unit": "无量纲", "min": 6.5, "max": 8.5, "limit": 9.0},
            {"type": "COD", "unit": "mg/L", "min": 10, "max": 50, "limit": 100},
            {"type": "氨氮", "unit": "mg/L", "min": 0.5, "max": 5, "limit": 15},
            {"type": "总磷", "unit": "mg/L", "min": 0.1, "max": 1.0, "limit": 3.0},
            {"type": "总氮", "unit": "mg/L", "min": 1.0, "max": 8.0, "limit": 20},
            {"type": "重金属 (Cr6+)", "unit": "mg/L", "min": 0.001, "max": 0.05, "limit": 0.1},
        ]
    },
    {
        "name": "重庆医科大学",
        "outlets": ["cqmu-1"],
        "pollutants": [
            {"type": "pH", "unit": "无量纲", "min": 6.5, "max": 8.5, "limit": 9.0},
            {"type": "COD", "unit": "mg/L", "min": 10, "max": 50, "limit": 100},
            {"type": "氨氮", "unit": "mg/L", "min": 0.5, "max": 5, "limit": 15},
            {"type": "总磷", "unit": "mg/L", "min": 0.1, "max": 1.0, "limit": 3.0},
            {"type": "总氮", "unit": "mg/L", "min": 1.0, "max": 8.0, "limit": 20},
            {"type": "重金属 (Cr6+)", "unit": "mg/L", "min": 0.001, "max": 0.05, "limit": 0.1},
        ]
    },
    {
        "name": "重庆师范大学",
        "outlets": ["cqnu-1"],
        "pollutants": [
            {"type": "pH", "unit": "无量纲", "min": 6.5, "max": 8.5, "limit": 9.0},
            {"type": "COD", "unit": "mg/L", "min": 10, "max": 50, "limit": 100},
            {"type": "氨氮", "unit": "mg/L", "min": 0.5, "max": 5, "limit": 15},
            {"type": "总磷", "unit": "mg/L", "min": 0.1, "max": 1.0, "limit": 3.0},
            {"type": "总氮", "unit": "mg/L", "min": 1.0, "max": 8.0, "limit": 20},
            {"type": "重金属 (Cr6+)", "unit": "mg/L", "min": 0.001, "max": 0.05, "limit": 0.1},
        ]
    },
    {
        "name": "四川美术学院",
        "outlets": ["sfai-1", "sfai-2"],
        "pollutants": [
            {"type": "pH", "unit": "无量纲", "min": 6.5, "max": 8.5, "limit": 9.0},
            {"type": "COD", "unit": "mg/L", "min": 10, "max": 50, "limit": 100},
            {"type": "氨氮", "unit": "mg/L", "min": 0.5, "max": 5, "limit": 15},
            {"type": "总磷", "unit": "mg/L", "min": 0.1, "max": 1.0, "limit": 3.0},
            {"type": "总氮", "unit": "mg/L", "min": 1.0, "max": 8.0, "limit": 20},
            {"type": "重金属 (Cr6+)", "unit": "mg/L", "min": 0.001, "max": 0.05, "limit": 0.1},
        ]
    },
    {
        "name": "重庆科技大学",
        "outlets": ["cqust-1", "cqust-2"],
        "pollutants": [
            {"type": "pH", "unit": "无量纲", "min": 6.5, "max": 8.5, "limit": 9.0},
            {"type": "COD", "unit": "mg/L", "min": 10, "max": 50, "limit": 100},
            {"type": "氨氮", "unit": "mg/L", "min": 0.5, "max": 5, "limit": 15},
            {"type": "总磷", "unit": "mg/L", "min": 0.1, "max": 1.0, "limit": 3.0},
            {"type": "总氮", "unit": "mg/L", "min": 1.0, "max": 8.0, "limit": 20},
            {"type": "重金属 (Cr6+)", "unit": "mg/L", "min": 0.001, "max": 0.05, "limit": 0.1},
        ]
    },
]

# 日期范围：7.20 - 7.23
start_date = datetime(2026, 7, 20)
end_date = datetime(2026, 7, 23, 23, 59, 59)

def generate_data():
    """生成监测数据"""
    for enterprise in enterprises:
        wb = Workbook()
        ws = wb.active
        ws.title = "监测数据"
        
        # 表头
        headers = ["排污口", "污染物类型", "监测值", "单位", "标准限值", "状态", "监测时间 (中国时间)", "备注"]
        ws.append(headers)
        
        # 生成数据
        for outlet in enterprise["outlets"]:
            for pollutant in enterprise["pollutants"]:
                # 每天生成 4 个时间点的数据（6:00, 12:00, 18:00, 00:00）
                current_date = start_date
                while current_date <= end_date:
                    for hour in [6, 12, 18, 0]:
                        monitored_at = current_date.replace(hour=hour, minute=0, second=0)
                        
                        # 生成随机值
                        value = round(random.uniform(pollutant["min"], pollutant["max"]), 3)
                        
                        # 判断状态
                        if value >= pollutant["limit"]:
                            status = "超标"
                        elif value >= pollutant["limit"] * 0.8:
                            status = "预警"
                        else:
                            status = "正常"
                        
                        # 添加数据行
                        ws.append([
                            outlet,
                            pollutant["type"],
                            value,
                            pollutant["unit"],
                            pollutant["limit"],
                            status,
                            monitored_at.strftime("%Y-%m-%d %H:%M:%S"),
                            ""
                        ])
                    
                    current_date += timedelta(days=1)
        
        # 保存文件
        filename = f"/workspace/projects/public/{enterprise['name']}_monitoring_data.xlsx"
        wb.save(filename)
        print(f"生成文件：{filename}")

if __name__ == "__main__":
    generate_data()
    print("数据生成完成！")
